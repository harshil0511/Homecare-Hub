"""Shared constants used across multiple modules."""

BOOKING_CONFLICT_WINDOW_HOURS = 3
EMERGENCY_RATE_MULTIPLIER = 1.5

ALLOWED_CATEGORIES = [
    "AC Service",
    "Appliance Repair",
    "Home Cleaning",
    "Plumbing",
    "Electrical",
    "Pest Control",
    "Painting",
    "Carpentry",
    "General Maintenance",
]

ROUTINE_CATEGORY_MAP: dict[str, list[str]] = {
    "AC Service": ["HVAC", "Air Conditioning", "AC Service"],
    "Appliance Repair": ["Appliance Repair", "Electrical", "General"],
    "Home Cleaning": ["Cleaning", "Home Cleaning"],
    "Plumbing": ["Plumbing"],
    "Electrical": ["Electrical"],
    "Pest Control": ["Pest Control"],
    "Painting": ["Painting"],
    "Carpentry": ["Carpentry"],
    "General Maintenance": ["General", "General Maintenance"],
}

EMERGENCY_CATEGORIES = [
    "Electrical", "Plumbing", "Gas Leak", "Lock/Door",
    "Appliance Failure", "Structural", "Pest", "Other",
]
