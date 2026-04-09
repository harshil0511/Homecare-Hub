"""Service domain business logic helpers."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.service.domain.model import ServiceProvider, ServiceCertificate
from app.booking.domain.model import ServiceBooking
from app.common.constants import BOOKING_CONFLICT_WINDOW_HOURS, ROUTINE_CATEGORY_MAP


def get_provider_display_name(provider: ServiceProvider) -> str:
    """Return a human-readable name for a provider."""
    return (
        provider.first_name
        or provider.company_name
        or provider.owner_name
        or "Unknown Provider"
    )


def find_verified_provider(
    db: Session,
    category: Optional[str],
    location: Optional[str] = None,
    society_id: Optional[int] = None,
) -> Optional[ServiceProvider]:
    """Find the best available verified provider with a matching certificate."""
    if not category:
        return None

    mapped_categories = ROUTINE_CATEGORY_MAP.get(category, [category])
    category_filters = []
    for cat in mapped_categories:
        category_filters.append(ServiceProvider.category == cat)
        category_filters.append(ServiceProvider.categories.like(f"%{cat}%"))

    query = db.query(ServiceProvider).filter(
        or_(*category_filters),
        ServiceProvider.is_verified == True,
        ServiceProvider.availability_status == "AVAILABLE",
    )

    cert_category_filters = []
    for cat in mapped_categories:
        cert_category_filters.append(ServiceCertificate.category.ilike(f"%{cat}%"))
    query = query.join(ServiceCertificate).filter(or_(*cert_category_filters))

    if location:
        query = query.filter(ServiceProvider.location.ilike(f"%{location}%"))

    if society_id:
        query = query.filter(
            (ServiceProvider.society_id == society_id)
            | (ServiceProvider.society_id == None)
        )

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=BOOKING_CONFLICT_WINDOW_HOURS)
    window_end = now + timedelta(hours=BOOKING_CONFLICT_WINDOW_HOURS)

    providers = query.order_by(ServiceProvider.rating.desc()).all()
    for provider in providers:
        conflict = (
            db.query(ServiceBooking)
            .filter(
                ServiceBooking.provider_id == provider.id,
                ServiceBooking.status.in_(["Pending", "Accepted", "In Progress"]),
                ServiceBooking.scheduled_at >= window_start,
                ServiceBooking.scheduled_at <= window_end,
            )
            .first()
        )
        if not conflict:
            return provider

    return None
