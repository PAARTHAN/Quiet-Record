from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    last_check_in: datetime
    inactivity_days: int
    grace_hours: int
    is_triggered: bool
    warning_sent: bool
    last_message: Optional[str] = None

    class Config:
        from_attributes = True


class TrustedContactCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    relationship: Optional[str] = None


class TrustedContactUpdate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    relationship: Optional[str] = None


class TrustedContactResponse(BaseModel):
    id: int
    user_id: int
    name: str
    email: EmailStr
    phone: Optional[str] = None
    relationship_name: Optional[str] = None

    model_config = {"from_attributes": True}


class RecordBase(BaseModel):
    title: str
    category: str
    amount: Optional[str] = None
    owner: Optional[str] = None
    details: Optional[str] = None


class RecordCreate(RecordBase):
    pass


class RecordUpdate(RecordBase):
    pass


class RecordResponse(RecordBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class LastMessageUpdate(BaseModel):
    last_message: Optional[str] = None


class LastMessageResponse(BaseModel):
    message: str
    last_message: Optional[str] = None
