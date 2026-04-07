"""Point engine — awards/deducts points for a provider and recalculates their star rating."""

import uuid
import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.internal.models import ServiceProvider, ProviderPoints


# Points configuration
POINTS = {
    "EMERGENCY_COMPLETE": 35.0,
    "URGENT_COMPLETE": 20.0,
    "REGULAR_COMPLETE": 15.0,
    "EMERGENCY_CANCEL": -20.0,
    "REGULAR_CANCEL": -10.0,
    "FEEDBACK_5_STAR": 10.0,
    "FEEDBACK_4_STAR": 8.0,
    "FEEDBACK_3_STAR": 5.0,
    "FEEDBACK_2_STAR": 2.0,
    "FEEDBACK_1_STAR": 0.0,
    "REVIEW_WRITTEN": 2.0,
}

POINTS_PER_STAR = 100.0


def award_points(
    db: Session,
    provider_id: uuid.UUID,
    event_type: str,
    source_id: Optional[uuid.UUID] = None,
    note: Optional[str] = None,
    custom_delta: Optional[float] = None,
) -> None:
    """
    Insert a provider_points row and recalculate ServiceProvider.rating.
    Uses custom_delta if provided, otherwise looks up the event_type in POINTS.
    Commits all changes.
    """
    delta = custom_delta if custom_delta is not None else POINTS.get(event_type, 0.0)
    if delta == 0.0 and event_type not in ("FEEDBACK_1_STAR", "ADMIN_ADJUSTMENT"):
        return

    row = ProviderPoints(
        id=uuid.uuid4(),
        provider_id=provider_id,
        delta=delta,
        event_type=event_type,
        source_id=source_id,
        note=note,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(row)

    # Query existing committed points, then add the new delta manually
    existing_total: float = db.query(func.sum(ProviderPoints.delta)).filter(
        ProviderPoints.provider_id == provider_id
    ).scalar() or 0.0
    total = existing_total + delta

    new_rating = max(0.0, total / POINTS_PER_STAR)

    provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if provider:
        provider.rating = round(new_rating, 2)
        # Auto-verify when provider earns 10 stars for the first time
        if new_rating >= 10.0 and not provider.is_verified:
            provider.is_verified = True
            from app.internal.models import Notification
            notif = Notification(
                id=uuid.uuid4(),
                user_id=provider.user_id,
                title="You've been automatically verified!",
                message=(
                    "Congratulations! You've earned 10 stars through your outstanding work. "
                    "Your profile is now automatically verified."
                ),
                notification_type="SYSTEM",
                is_read=False,
                created_at=datetime.datetime.utcnow(),
            )
            db.add(notif)

    db.commit()
