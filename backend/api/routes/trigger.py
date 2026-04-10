from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import User
from core.config import TRIGGER_THRESHOLD_SECONDS, WARNING_THRESHOLD_SECONDS
from core.utils import as_api_datetime_string, to_ist_string, utc_now
from services.trigger_engine import seconds_since_check_in, run_release

router = APIRouter()

@router.get("/trigger-status/{user_id}")
def trigger_status(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    seconds_since = seconds_since_check_in(user)
    seconds_until_trigger = max(0, TRIGGER_THRESHOLD_SECONDS - seconds_since)
    seconds_until_warning = max(0, WARNING_THRESHOLD_SECONDS - seconds_since)

    return {
        "is_triggered": user.is_triggered,
        "warning_sent": user.warning_sent,
        "threshold_seconds": TRIGGER_THRESHOLD_SECONDS,
        "warning_threshold_seconds": WARNING_THRESHOLD_SECONDS,
        "seconds_since_check_in": seconds_since,
        "seconds_until_trigger": seconds_until_trigger,
        "seconds_until_warning": seconds_until_warning,
        "last_check_in": as_api_datetime_string(user.last_check_in),
        "last_check_in_display": to_ist_string(user.last_check_in),
        "server_time_display": to_ist_string(utc_now()),
    }

@router.post("/simulate-trigger/{user_id}")
def simulate_trigger(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return run_release(user, db)
