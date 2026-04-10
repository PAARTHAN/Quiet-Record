from datetime import datetime
import pytz
from core.config import IST

def utc_now() -> datetime:
    return datetime.now(pytz.utc)

def utc_naive_now() -> datetime:
    return datetime.utcnow()

def ensure_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return pytz.utc.localize(value)
    return value.astimezone(pytz.utc)

def to_ist_string(value: datetime | None) -> str:
    if value is None:
        return "Not available"
    value = ensure_utc(value)
    assert value is not None
    return value.astimezone(IST).strftime("%d %b %Y, %I:%M:%S %p IST")

def as_api_datetime_string(value: datetime | None) -> str | None:
    if value is None:
        return None
    value = ensure_utc(value)
    assert value is not None
    return value.astimezone(IST).isoformat()
