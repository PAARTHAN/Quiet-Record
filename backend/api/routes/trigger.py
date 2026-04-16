from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import User
from core.config import TRIGGER_THRESHOLD_SECONDS, WARNING_THRESHOLD_SECONDS
from core.utils import as_api_datetime_string, to_ist_string, utc_now
from services.trigger_engine import seconds_since_check_in, run_release
from .users import get_current_user

router = APIRouter(prefix="/trigger", tags=["trigger"])

@router.get("/status")
def trigger_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    seconds_since = seconds_since_check_in(current_user)
    seconds_until_trigger = max(0, TRIGGER_THRESHOLD_SECONDS - seconds_since)
    seconds_until_warning = max(0, WARNING_THRESHOLD_SECONDS - seconds_since)

    return {
        "is_triggered": current_user.is_triggered,
        "warning_sent": current_user.warning_sent,
        "threshold_seconds": TRIGGER_THRESHOLD_SECONDS,
        "warning_threshold_seconds": WARNING_THRESHOLD_SECONDS,
        "seconds_since_check_in": seconds_since,
        "seconds_until_trigger": seconds_until_trigger,
        "seconds_until_warning": seconds_until_warning,
        "last_check_in": as_api_datetime_string(current_user.last_check_in),
        "last_check_in_display": to_ist_string(current_user.last_check_in),
        "server_time_display": to_ist_string(utc_now()),
    }

@router.post("/simulate")
def simulate_trigger(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return run_release(current_user, db)
