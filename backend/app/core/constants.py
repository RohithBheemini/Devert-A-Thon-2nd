"""Domain constants: issue taxonomy, routing table, action library.

The MVP locks exactly 4 issue classes. Everything here is deterministic
configuration so operational decisions (routing, actions, thresholds)
never depend on model output.
"""

from enum import Enum


class IssueType(str, Enum):
    POTHOLE = "pothole"
    GARBAGE_OVERFLOW = "garbage_overflow"
    WATER_LEAKAGE = "water_leakage"
    BROKEN_STREETLIGHT = "broken_streetlight"


# Canonical display labels
ISSUE_LABELS: dict[str, str] = {
    IssueType.POTHOLE.value: "Pothole / Road Defect",
    IssueType.GARBAGE_OVERFLOW.value: "Garbage Overflow",
    IssueType.WATER_LEAKAGE.value: "Water Leakage",
    IssueType.BROKEN_STREETLIGHT.value: "Broken Streetlight",
}

DEPARTMENT_LABELS: dict[str, str] = {
    "ROAD_MAINTENANCE": "Road Maintenance",
    "SANITATION": "Sanitation",
    "WATER_DRAINAGE": "Water / Drainage",
    "STREET_LIGHTING": "Electrical / Street Lighting",
}

DAILY_ROUTING_TEMPLATE: dict[str, str] = {
    "pothole": "ROAD_MAINTENANCE",
    "road_crack": "ROAD_MAINTENANCE",
    "speed_breaker": "ROAD_MAINTENANCE",
    "garbage_overflow": "SANITATION",
    "water_leakage": "WATER_DRAINAGE",
    "broken_streetlight": "STREET_LIGHTING",
}

# Alias normalization: descriptive terms map into the 4 locked classes.
ISSUE_ALIASES: dict[str, str] = {
    "pothole": IssueType.POTHOLE.value,
    "potholes": IssueType.POTHOLE.value,
    "road defect": IssueType.POTHOLE.value,
    "road defects": IssueType.POTHOLE.value,
    "road damage": IssueType.POTHOLE.value,
    "road crack": IssueType.POTHOLE.value,
    "speed breaker": IssueType.POTHOLE.value,
    "speed bump": IssueType.POTHOLE.value,
    "deadly road": IssueType.POTHOLE.value,
    "garbage": IssueType.GARBAGE_OVERFLOW.value,
    "garbage overflow": IssueType.GARBAGE_OVERFLOW.value,
    "trash": IssueType.GARBAGE_OVERFLOW.value,
    "waste": IssueType.GARBAGE_OVERFLOW.value,
    "litter": IssueType.GARBAGE_OVERFLOW.value,
    "rubbish": IssueType.GARBAGE_OVERFLOW.value,
    "water leakage": IssueType.WATER_LEAKAGE.value,
    "water leak": IssueType.WATER_LEAKAGE.value,
    "leakage": IssueType.WATER_LEAKAGE.value,
    "leaking water": IssueType.WATER_LEAKAGE.value,
    "pipe leak": IssueType.WATER_LEAKAGE.value,
    "water overflow": IssueType.WATER_LEAKAGE.value,
    "streetlight": IssueType.BROKEN_STREETLIGHT.value,
    "street light": IssueType.BROKEN_STREETLIGHT.value,
    "street lamp": IssueType.BROKEN_STREETLIGHT.value,
    "broken light": IssueType.BROKEN_STREETLIGHT.value,
    "light not working": IssueType.BROKEN_STREETLIGHT.value,
    "lamp not working": IssueType.BROKEN_STREETLIGHT.value,
    "dark street": IssueType.BROKEN_STREETLIGHT.value,
}

# Keyword hints per class used by the deterministic text classifier.
CLASSIFY_KEYWORDS: dict[str, list[str]] = {
    IssueType.POTHOLE.value: [
        "pothole", "potholes", "hole in", "hole", "road hole", "road defect",
        "road damage", "road crack", "cracked road", "speed breaker",
        "speed bump", "damaged road", "road is bad", "bumpy road", "crater",
    ],
    IssueType.GARBAGE_OVERFLOW.value: [
        "garbage", "trash", "overflowing", "waste", "litter", "rubbish",
        "dump", "waste pile", "dustbin full", "garbage pile",
    ],
    IssueType.WATER_LEAKAGE.value: [
        "water leak", "leakage", "leaking", "pipe burst", "water flowing",
        "water overflow", "dripping", "water log", "sewage",
    ],
    IssueType.BROKEN_STREETLIGHT.value: [
        "streetlight", "street light", "lamp", "light not working",
        "light broken", "dark street", "no light at night",
        "street lamp", "light failed",
    ],
}

# --- Constrained action library (Addendum section 9) ---
ACTION_LIBRARY: dict[str, dict[str, list[str]]] = {
    IssueType.POTHOLE.value: {
        "general": [
            "Inspect the reported location",
            "Assess hazard severity",
            "Apply temporary warning/marking if necessary",
            "Schedule road repair",
        ],
        "high": [
            "Prioritize urgent field inspection",
            "Assess hazard severity immediately",
            "Apply temporary warning/marking if necessary",
            "Schedule road repair",
        ],
        "low": [
            "Inspect the reported location",
            "Schedule road repair",
        ],
    },
    IssueType.GARBAGE_OVERFLOW.value: {
        "general": [
            "Verify accumulation",
            "Dispatch sanitation vehicle",
            "Inspect collection route",
            "Record clearance",
        ],
        "high": [
            "Dispatch sanitation vehicle immediately",
            "Verify accumulation",
            "Inspect collection route",
            "Record clearance",
        ],
        "low": [
            "Inspect collection route",
            "Schedule clearance",
        ],
    },
    IssueType.WATER_LEAKAGE.value: {
        "general": [
            "Inspect leakage source",
            "Assess public-road impact",
            "Check drainage/water infrastructure",
            "Schedule repair/isolation if required",
        ],
        "high": [
            "Inspect leakage source urgently",
            "Assess public-road impact immediately",
            "Check drainage/water infrastructure",
            "Schedule repair/isolation if required",
        ],
        "low": [
            "Inspect leakage source",
            "Schedule repair if required",
        ],
    },
    IssueType.BROKEN_STREETLIGHT.value: {
        "general": [
            "Inspect pole/light",
            "Verify electrical fault",
            "Schedule maintenance/replacement",
        ],
        "high": [
            "Inspect pole/light urgently",
            "Verify electrical fault",
            "Schedule maintenance/replacement",
        ],
        "low": [
            "Schedule inspection",
            "Verify electrical fault",
        ],
    },
}

ISSUE_DEFAULT_ACTIONS: dict[str, list[str]] = {
    IssueType.POTHOLE.value: ACTION_LIBRARY[IssueType.POTHOLE.value]["general"],
    IssueType.GARBAGE_OVERFLOW.value: ACTION_LIBRARY[IssueType.GARBAGE_OVERFLOW.value]["general"],
    IssueType.WATER_LEAKAGE.value: ACTION_LIBRARY[IssueType.WATER_LEAKAGE.value]["general"],
    IssueType.BROKEN_STREETLIGHT.value: ACTION_LIBRARY[IssueType.BROKEN_STREETLIGHT.value]["general"],
}