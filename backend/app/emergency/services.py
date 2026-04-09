"""Emergency domain business logic helpers."""

from app.service.domain.model import ServiceProvider


def calculate_emergency_bill(callout_fee: float, hourly_rate: float, actual_hours: float) -> float:
    """
    Billing formula:
      - callout_fee covers the first hour (minimum charge)
      - each hour beyond the first is billed at hourly_rate
    """
    extra_hours = max(0.0, actual_hours - 1.0)
    return callout_fee + (extra_hours * hourly_rate)


def apply_star_delta(provider: ServiceProvider, delta: float) -> None:
    """Mutates provider.rating, clamped to [0.0, ∞). Caller must commit."""
    provider.rating = max(0.0, provider.rating + delta)
