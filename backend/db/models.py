from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Text, String
from sqlalchemy.orm import relationship

from db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    last_check_in = Column(DateTime, default=datetime.utcnow, nullable=False)
    inactivity_days = Column(Integer, default=5, nullable=False)
    grace_hours = Column(Integer, default=24, nullable=False)
    is_triggered = Column(Boolean, default=False, nullable=False)
    warning_sent = Column(Boolean, default=False, nullable=False)
    is_timer_active = Column(Boolean, default=False, nullable=False)
    emergency_package = Column(Text, nullable=True)
    last_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    contacts = relationship("TrustedContact", back_populates="user", cascade="all, delete-orphan")
    records = relationship("Record", back_populates="user", cascade="all, delete-orphan")


class TrustedContact(Base):
    __tablename__ = "trusted_contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    relationship_name = Column(String, nullable=True)

    user = relationship("User", back_populates="contacts")


class Record(Base):
    __tablename__ = "records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    amount = Column(String, nullable=True)
    owner = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="records")
