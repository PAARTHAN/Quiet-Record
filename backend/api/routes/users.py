from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import User
from schemas.schemas import UserCreate, UserResponse, LoginRequest, LastMessageUpdate, LastMessageResponse
from core.security import hash_password
from core.utils import utc_naive_now, as_api_datetime_string

router = APIRouter()

@router.post("/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        name=user.name,
        email=user.email,
        password_hash=hash_password(user.password),
        last_check_in=utc_naive_now(),
        warning_sent=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=UserResponse)
def login_user(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or user.password_hash != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return user

@router.get("/users", response_model=list[UserResponse])
def get_users(db: Session = Depends(get_db)):
    return db.query(User).all()

@router.put("/users/{user_id}/last-message", response_model=LastMessageResponse)
def update_last_message(user_id: int, payload: LastMessageUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.last_message = payload.last_message or ""
    db.commit()
    db.refresh(user)

    return {
        "message": "Last message updated successfully",
        "last_message": user.last_message,
    }

@router.post("/check-in/{user_id}")
def check_in(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.last_check_in = utc_naive_now()
    user.is_triggered = False
    user.warning_sent = False
    db.commit()
    db.refresh(user)
    return {
        "message": "Check-in successful",
        "last_check_in": as_api_datetime_string(user.last_check_in),
        "is_triggered": False,
        "warning_sent": False,
    }
