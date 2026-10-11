"""UTC time helpers.

SQLite stores naive datetimes. Comparing an aware value with a naive stored
value raises TypeError, which silently broke fusion. Convention: the whole
app uses naive UTC timestamps; aware values are normalized on comparison.
"""

from __future__ import annotations

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC now (what the DB stores)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def as_naive_utc(dt: datetime) -> datetime:
    """Return dt as a naive UTC datetime (drop tzinfo if present)."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt