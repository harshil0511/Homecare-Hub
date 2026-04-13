import logging
from datetime import datetime, timezone, timedelta
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.common import deps
from app.auth.domain.model import User, Society
from app.service.domain.model import ServiceProvider
from app.contract.domain.model import SocietyContract, SocietyDispatch
from app.notification.domain.model import Notification
from app.api.secretary.contracts_schemas import (
    SocietyContractCreate, SocietyContractRead,
    SocietyDispatchCreate, SocietyDispatchRead,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Secretary Contracts"])
secretary_only = deps.RoleChecker(["SECRETARY"])


def _get_society(current_user: User, db: Session) -> Society:
    if not current_user.society_id:
        raise HTTPException(status_code=404, detail="No society assigned to this secretary.")
    society = db.query(Society).filter(Society.id == current_user.society_id).first()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found.")
    return society


def _notify(db: Session, user_id, title: str, message: str,
            notification_type: str = "INFO", link: str = None) -> None:
    db.add(Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
    ))


@router.get("/", response_model=List[SocietyContractRead])
def list_contracts(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)
    return (
        db.query(SocietyContract)
        .filter(SocietyContract.society_id == society.id)
        .order_by(SocietyContract.created_at.desc())
        .all()
    )


@router.post("/", response_model=SocietyContractRead, status_code=201)
def create_contract(
    contract_in: SocietyContractCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)

    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == contract_in.provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found.")

    existing = db.query(SocietyContract).filter(
        SocietyContract.society_id == society.id,
        SocietyContract.provider_id == contract_in.provider_id,
        SocietyContract.status == "ACTIVE",
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="This provider already has an active contract with your society.",
        )

    contract = SocietyContract(
        society_id=society.id,
        provider_id=contract_in.provider_id,
        proposed_by=current_user.id,
        duration_months=contract_in.duration_months,
        monthly_rate=contract_in.monthly_rate,
        secretary_notes=contract_in.secretary_notes,
        status="PENDING",
    )
    db.add(contract)
    db.flush()

    if provider.user_id:
        _notify(
            db,
            user_id=provider.user_id,
            title="Society Contract Invite",
            message=(
                f"{society.name} invites you to a {contract_in.duration_months}-month "
                f"contract at \u20b9{contract_in.monthly_rate:.0f}/month."
            ),
            notification_type="INFO",
            link="/service/jobs?tab=society",
        )

    db.commit()
    db.refresh(contract)
    return contract


@router.post("/{contract_id}/confirm-counter", response_model=SocietyContractRead)
def confirm_counter(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.society_id == society.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "COUNTER_PROPOSED":
        raise HTTPException(
            status_code=400,
            detail=f"Contract is {contract.status}, not COUNTER_PROPOSED.",
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    contract.status = "ACTIVE"
    contract.duration_months = contract.counter_duration_months
    contract.start_date = now
    contract.end_date = now + timedelta(days=30 * contract.duration_months)

    if contract.provider.user_id:
        _notify(
            db,
            user_id=contract.provider.user_id,
            title="Contract Active",
            message=(
                f"Your {contract.duration_months}-month contract with "
                f"{society.name} is now active."
            ),
            notification_type="INFO",
            link="/service/jobs?tab=society",
        )

    db.commit()
    db.refresh(contract)
    return contract


@router.post("/{contract_id}/reject-counter", response_model=SocietyContractRead)
def reject_counter(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.society_id == society.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "COUNTER_PROPOSED":
        raise HTTPException(
            status_code=400,
            detail=f"Contract is {contract.status}, not COUNTER_PROPOSED.",
        )

    contract.status = "REJECTED"

    if contract.provider.user_id:
        _notify(
            db,
            user_id=contract.provider.user_id,
            title="Contract Counter Rejected",
            message=f"{society.name} rejected your counter-proposal. The invite is closed.",
            notification_type="INFO",
            link="/service/jobs?tab=society",
        )

    db.commit()
    db.refresh(contract)
    return contract


@router.delete("/{contract_id}", status_code=200)
def cancel_contract(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.society_id == society.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Only ACTIVE contracts can be cancelled.")

    contract.status = "CANCELLED"

    if contract.provider.user_id:
        _notify(
            db,
            user_id=contract.provider.user_id,
            title="Contract Cancelled",
            message=f"Your contract with {society.name} has been cancelled by the secretary.",
            notification_type="WARNING",
            link="/service/jobs?tab=society",
        )

    db.commit()
    return {"detail": "Contract cancelled."}


@router.post("/{contract_id}/dispatch", response_model=SocietyDispatchRead, status_code=201)
def dispatch_job(
    contract_id: UUID,
    dispatch_in: SocietyDispatchCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.society_id == society.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Can only dispatch on ACTIVE contracts.")

    member = db.query(User).filter(
        User.id == dispatch_in.member_id,
        User.society_id == society.id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in your society.")

    dispatch = SocietyDispatch(
        contract_id=contract_id,
        society_id=society.id,
        provider_id=contract.provider_id,
        member_id=dispatch_in.member_id,
        service_type=dispatch_in.service_type,
        scheduled_at=dispatch_in.scheduled_at,
        job_price=dispatch_in.job_price,
        notes=dispatch_in.notes,
        status="ASSIGNED",
    )
    db.add(dispatch)
    db.flush()

    if contract.provider.user_id:
        _notify(
            db,
            user_id=contract.provider.user_id,
            title="New Society Job Dispatched",
            message=(
                f"New job: {dispatch_in.service_type} on "
                f"{dispatch_in.scheduled_at.strftime('%b %d')}. "
                f"\u20b9{dispatch_in.job_price:.0f}."
            ),
            notification_type="INFO",
            link="/service/jobs?tab=society",
        )

    db.commit()
    db.refresh(dispatch)
    return dispatch


@router.get("/{contract_id}/dispatches", response_model=List[SocietyDispatchRead])
def list_dispatches(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.society_id == society.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    return (
        db.query(SocietyDispatch)
        .filter(SocietyDispatch.contract_id == contract_id)
        .order_by(SocietyDispatch.created_at.desc())
        .all()
    )
