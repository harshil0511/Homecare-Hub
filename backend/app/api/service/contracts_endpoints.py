import logging
from datetime import datetime, timezone, timedelta
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.common import deps
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.contract.domain.model import SocietyContract, SocietyDispatch
from app.notification.domain.model import Notification
from app.api.service.contracts_schemas import (
    SocietyContractCounterCreate, SocietyDispatchStatusUpdate,
    SocietyContractServicerRead, SocietyDispatchServicerRead,
    SocietySummary,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Servicer Contracts"])
servicer_only = deps.RoleChecker(["SERVICER"])


def _notify(db: Session, user_id, title: str, message: str,
            notification_type: str = "INFO", link: str = None) -> None:
    db.add(Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
    ))


def _get_provider(current_user: User, db: Session) -> ServiceProvider:
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found.")
    return provider


def _build_servicer_read(contract: SocietyContract) -> SocietyContractServicerRead:
    dispatches = []
    for d in contract.dispatches:
        member = d.member
        dispatches.append(SocietyDispatchServicerRead(
            id=d.id,
            service_type=d.service_type,
            scheduled_at=d.scheduled_at,
            job_price=d.job_price,
            notes=d.notes,
            status=d.status,
            created_at=d.created_at,
            member_home_number=member.home_number if member else None,
            member_name=member.username if member else None,
        ))

    society = contract.society
    society_summary = (
        SocietySummary(id=society.id, name=society.name, address=society.address)
        if society else None
    )

    return SocietyContractServicerRead(
        id=contract.id,
        society_id=contract.society_id,
        duration_months=contract.duration_months,
        counter_duration_months=contract.counter_duration_months,
        monthly_rate=contract.monthly_rate,
        start_date=contract.start_date,
        end_date=contract.end_date,
        status=contract.status,
        secretary_notes=contract.secretary_notes,
        servicer_notes=contract.servicer_notes,
        created_at=contract.created_at,
        society=society_summary,
        dispatches=dispatches,
    )


@router.get("/", response_model=List[SocietyContractServicerRead])
def list_my_contracts(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = _get_provider(current_user, db)
    contracts = (
        db.query(SocietyContract)
        .filter(
            SocietyContract.provider_id == provider.id,
            SocietyContract.status.in_(["PENDING", "COUNTER_PROPOSED", "ACTIVE"]),
        )
        .order_by(SocietyContract.created_at.desc())
        .all()
    )
    return [_build_servicer_read(c) for c in contracts]


@router.post("/{contract_id}/accept", response_model=SocietyContractServicerRead)
def accept_contract(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = _get_provider(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.provider_id == provider.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Contract is {contract.status}, not PENDING.",
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    contract.status = "ACTIVE"
    contract.start_date = now
    contract.end_date = now + timedelta(days=30 * contract.duration_months)

    secretary = db.query(User).filter(User.id == contract.proposed_by).first()
    if secretary:
        _notify(
            db,
            user_id=secretary.id,
            title="Contract Accepted",
            message=(
                f"Provider {provider.company_name} accepted the "
                f"{contract.duration_months}-month contract."
            ),
            notification_type="INFO",
            link="/secretary/contracts",
        )

    db.commit()
    db.refresh(contract)
    return _build_servicer_read(contract)


@router.post("/{contract_id}/reject", status_code=200)
def reject_contract(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = _get_provider(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.provider_id == provider.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Contract is {contract.status}, not PENDING.",
        )

    contract.status = "REJECTED"

    secretary = db.query(User).filter(User.id == contract.proposed_by).first()
    if secretary:
        _notify(
            db,
            user_id=secretary.id,
            title="Contract Rejected",
            message=f"Provider {provider.company_name} declined the contract invite.",
            notification_type="INFO",
            link="/secretary/contracts",
        )

    db.commit()
    return {"detail": "Contract rejected."}


@router.post("/{contract_id}/counter", response_model=SocietyContractServicerRead)
def counter_contract(
    contract_id: UUID,
    counter_in: SocietyContractCounterCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = _get_provider(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.provider_id == provider.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Can only counter a PENDING contract. Current: {contract.status}",
        )

    contract.status = "COUNTER_PROPOSED"
    contract.counter_duration_months = counter_in.counter_duration_months
    contract.servicer_notes = counter_in.servicer_notes

    secretary = db.query(User).filter(User.id == contract.proposed_by).first()
    if secretary:
        _notify(
            db,
            user_id=secretary.id,
            title="Contract Counter-Proposal",
            message=(
                f"Provider {provider.company_name} counter-proposed: "
                f"{counter_in.counter_duration_months} months."
            ),
            notification_type="INFO",
            link="/secretary/contracts",
        )

    db.commit()
    db.refresh(contract)
    return _build_servicer_read(contract)


@router.get("/{contract_id}/jobs", response_model=List[SocietyDispatchServicerRead])
def list_my_jobs(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = _get_provider(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.provider_id == provider.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")

    result = []
    for d in (
        db.query(SocietyDispatch)
        .filter(SocietyDispatch.contract_id == contract_id)
        .order_by(SocietyDispatch.scheduled_at.asc())
        .all()
    ):
        member = d.member
        result.append(SocietyDispatchServicerRead(
            id=d.id,
            service_type=d.service_type,
            scheduled_at=d.scheduled_at,
            job_price=d.job_price,
            notes=d.notes,
            status=d.status,
            created_at=d.created_at,
            member_home_number=member.home_number if member else None,
            member_name=member.username if member else None,
        ))
    return result


@router.patch("/{contract_id}/jobs/{dispatch_id}", status_code=200)
def update_dispatch_status(
    contract_id: UUID,
    dispatch_id: UUID,
    update_in: SocietyDispatchStatusUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = _get_provider(current_user, db)
    dispatch = db.query(SocietyDispatch).filter(
        SocietyDispatch.id == dispatch_id,
        SocietyDispatch.contract_id == contract_id,
        SocietyDispatch.provider_id == provider.id,
    ).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found.")

    valid_transitions = {
        "ASSIGNED": ["IN_PROGRESS"],
        "IN_PROGRESS": ["COMPLETED"],
    }
    if update_in.status not in valid_transitions.get(dispatch.status, []):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {dispatch.status} to {update_in.status}.",
        )

    dispatch.status = update_in.status
    db.commit()
    return {"detail": f"Dispatch status updated to {update_in.status}."}
