"""Service domain business logic helpers."""

from app.service.domain.model import ServiceProvider


def get_provider_display_name(provider: ServiceProvider) -> str:
    """Return a human-readable name for a provider."""
    return (
        provider.first_name
        or provider.company_name
        or provider.owner_name
        or "Unknown Provider"
    )
