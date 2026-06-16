from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import asyncio
from jose import jwt, JWTError

from db.database import get_db
from db.models import User
from core.config import TRIGGER_THRESHOLD_SECONDS, WARNING_THRESHOLD_SECONDS, SECRET_KEY, ALGORITHM
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
        "is_timer_active": current_user.is_timer_active,
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

@router.websocket("/ws/status")
async def websocket_status(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    await websocket.accept()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            await websocket.close(code=1008)
            return
    except JWTError:
        await websocket.close(code=1008)
        return

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        await websocket.close(code=1008)
        return

    try:
        while True:
            # Refresh user from database to get the latest status
            db.refresh(user)
            
            seconds_since = seconds_since_check_in(user)
            seconds_until_trigger = max(0, TRIGGER_THRESHOLD_SECONDS - seconds_since)
            seconds_until_warning = max(0, WARNING_THRESHOLD_SECONDS - seconds_since)
            
            data = {
                "is_timer_active": user.is_timer_active,
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
            await websocket.send_json(data)
            await asyncio.sleep(5) # Push every 5 seconds
    except WebSocketDisconnect:
        print(f"Client {email} disconnected from status socket")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.close()
        except:
            pass
