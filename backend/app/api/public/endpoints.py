from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.common.deps import get_db
from app.service.domain.model import ServiceProvider
from app.booking.domain.model import ServiceBooking

router = APIRouter(tags=["Public"])


@router.get("/stats")
def get_public_stats(db: Session = Depends(get_db)):
    total_bookings = db.query(func.count(ServiceBooking.id)).scalar() or 0

    avg_rating_result = db.query(func.avg(ServiceProvider.rating)).filter(
        ServiceProvider.is_verified == True,
        ServiceProvider.rating > 0,
    ).scalar()
    avg_rating = round(float(avg_rating_result), 1) if avg_rating_result else None

    top_providers = (
        db.query(ServiceProvider)
        .filter(ServiceProvider.is_verified == True)
        .order_by(ServiceProvider.rating.desc())
        .limit(5)
        .all()
    )

    provider_avatars: list[str] = []
    for p in top_providers:
        name = (p.company_name or "").strip()
        words = name.split()
        if len(words) >= 2:
            initials = (words[0][0] + words[1][0]).upper()
        elif len(words) == 1 and len(words[0]) >= 2:
            initials = words[0][:2].upper()
        else:
            initials = "SP"
        provider_avatars.append(initials)

    return {
        "total_bookings": total_bookings,
        "avg_rating": avg_rating,
        "provider_avatars": provider_avatars,
    }
