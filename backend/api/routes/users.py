from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from db.database import get_db
from db.models import User
from schemas.schemas import (
    UserCreate, UserResponse, Token, TokenData, LastMessageUpdate, 
    LastMessageResponse, ForgotPasswordRequest, ResetPasswordRequest
)
from core.security import (
    hash_password, verify_password, create_access_token, 
    create_refresh_token, create_password_reset_token, verify_password_reset_token
)
from core.utils import utc_naive_now, as_api_datetime_string
from core.config import SECRET_KEY, ALGORITHM
from services.email_service import send_password_reset_email

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    return user

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

@router.post("/login", response_model=Token)
def login_user(response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # Set True in production over HTTPS
        samesite="lax",
        max_age=7 * 24 * 60 * 60  # 7 days
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh", response_model=Token)
def refresh_token(response: Response, refresh_token: str = Cookie(None), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not refresh_token:
        raise credentials_exception

    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    access_token = create_access_token(data={"sub": user.email})
    new_refresh_token = create_refresh_token(data={"sub": user.email})
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 60 * 60
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
def logout_user(response: Response):
    response.delete_cookie(key="refresh_token", httponly=True, samesite="lax")
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=list[UserResponse])
def get_users(db: Session = Depends(get_db)):
    return db.query(User).all()

@router.put("/users/me/last-message", response_model=LastMessageResponse)
def update_last_message_me(payload: LastMessageUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.last_message = payload.last_message or ""
    db.commit()
    db.refresh(current_user)
    return {
        "message": "Last message updated successfully",
        "last_message": current_user.last_message,
    }

@router.post("/check-in")
def check_in_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.last_check_in = utc_naive_now()
    current_user.is_triggered = False
    current_user.warning_sent = False
    current_user.is_timer_active = True
    db.commit()
    db.refresh(current_user)
    return {
        "message": "Check-in successful",
        "last_check_in": as_api_datetime_string(current_user.last_check_in),
        "is_triggered": False,
        "warning_sent": False,
    }


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    # We always return 200 for security, to avoid revealing if an email exists
    if user:
        token = create_password_reset_token(user.email, user.password_hash)
        send_password_reset_email(user.email, token)
    
    return {"message": "If an account exists with this email, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    # 1. We don't know the user yet, but the token is signed with their (old) password hash.
    # We need to find the user first. But how? The token contains 'sub' (email).
    # We can decode without verification to get 'sub'.
    try:
        from jose import jwt as jose_jwt
        unverified_payload = jose_jwt.get_unverified_claims(payload.token)
        email = unverified_payload.get("sub")
        if not email:
            raise HTTPException(status_code=400, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token or user not found")

    # 2. Now verify with the user's password hash
    verified_email = verify_password_reset_token(payload.token, user.password_hash)
    if not verified_email or verified_email != email:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # 3. Update password
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    
    return {"message": "Password updated successfully"}
