from __future__ import annotations

import hashlib
import os
import smtplib
import threading
import time
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path

import pytz
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine
from models import Record, TrustedContact, User
from schemas import (
    LastMessageResponse,
    LastMessageUpdate,
    LoginRequest,
    RecordCreate,
    RecordResponse,
    RecordUpdate,
    TrustedContactCreate,
    TrustedContactResponse,
    TrustedContactUpdate,
    UserCreate,
    UserResponse,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Death Note Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTBOX_DIR = Path(__file__).resolve().parent / "outbox"
OUTBOX_DIR.mkdir(exist_ok=True)

IST = pytz.timezone("Asia/Kolkata")
TRIGGER_THRESHOLD_SECONDS = int(os.getenv("TRIGGER_THRESHOLD_SECONDS", "30"))
WARNING_THRESHOLD_SECONDS = int(os.getenv("WARNING_THRESHOLD_SECONDS", "15"))
AUTOTRIGGER_POLL_SECONDS = int(os.getenv("AUTOTRIGGER_POLL_SECONDS", "1"))


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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(raw_password: str) -> str:
    return hashlib.sha256(raw_password.encode("utf-8")).hexdigest()


def send_emergency_email(
    recipients: list[str],
    subject: str,
    body: str,
    attachment_name: str | None = None,
    attachment_content: str | None = None,
) -> tuple[bool, str]:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL") or smtp_username
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    if not (smtp_host and smtp_port and smtp_from_email):
        return False, "SMTP is not configured"

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_from_email
    message["To"] = ", ".join(recipients)
    message.set_content(body)

    if attachment_name and attachment_content:
        message.add_attachment(
            attachment_content.encode("utf-8"),
            maintype="text",
            subtype="plain",
            filename=attachment_name,
        )

    with smtplib.SMTP(smtp_host, int(smtp_port)) as server:
        if use_tls:
            server.starttls()
        if smtp_username and smtp_password:
            server.login(smtp_username, smtp_password)
        server.send_message(message)

    return True, "Emails sent successfully"


def send_warning_email(user: User) -> tuple[bool, str]:
    subject = f"Death Note inactivity warning for {user.name}"
    body = (
        f"Hello {user.name},\n\n"
        f"We noticed that you have not checked in to Death Note application recently and we're not sure whether you're okay!.\n"
        f"This is a warning message sent to remind you to login and check-in.\n\n"
        f"If you are safe, please open the app and use the check-in action before the final trigger.\n\n"
        f"Warning generated at: {to_ist_string(utc_now())}\n"
    )
    return send_emergency_email([user.email], subject, body)


def get_dashboard_intelligence(records: list[Record]) -> dict:
    def safe_amount(value) -> float:
        try:
            return float(value or 0)
        except Exception:
            return 0.0

    highest_debt = None
    highest_owed = None
    highest_asset = None

    for record in records:
        amount = safe_amount(record.amount)
        category = (record.category or "Other").lower()

        if category in ["debt", "bill"]:
            if highest_debt is None or amount > highest_debt["amount"]:
                highest_debt = {"title": record.title, "amount": amount, "owner": record.owner}
        elif category in ["money owed to me", "lent", "owed", "receivable"]:
            if highest_owed is None or amount > highest_owed["amount"]:
                highest_owed = {"title": record.title, "amount": amount, "owner": record.owner}
        else:
            if highest_asset is None or amount > highest_asset["amount"]:
                highest_asset = {"title": record.title, "amount": amount, "owner": record.owner}

    return {
        "highest_debt": highest_debt,
        "highest_owed": highest_owed,
        "strongest_asset": highest_asset,
    }


def build_emergency_report(user: User, contacts: list[TrustedContact], db: Session) -> str:
    records = db.query(Record).filter(Record.user_id == user.id).all()

    def safe_amount(value) -> float:
        try:
            return float(value or 0)
        except Exception:
            return 0.0

    def money(value: float) -> str:
        return f"₹ {value:,.2f}"

    total_debt = 0.0
    total_owed_to_me = 0.0
    total_assets = 0.0
    grouped: dict[str, list[Record]] = {}

    for r in records:
        category = (r.category or "Other").strip()
        grouped.setdefault(category, []).append(r)
        amount = safe_amount(r.amount)
        category_lower = category.lower()
        if category_lower in ["debt", "bill"]:
            total_debt += amount
        elif category_lower in ["money owed to me", "lent", "owed", "receivable"]:
            total_owed_to_me += amount
        else:
            total_assets += amount

    intel = get_dashboard_intelligence(records)

    sections: list[str] = []
    sections.append("DEATH NOTE - EMERGENCY INFORMATION REPORT")
    sections.append("")
    sections.append(f"Prepared for trusted contacts of {user.name}.")
    sections.append(f"This report summarizes the key liabilities, receivables, assets, and personal note left by {user.name}.")
    sections.append("")
    sections.append("I believe in YOU, Go ahead read this document🙂")
    sections.append("")
    sections.append("=" * 88)
    sections.append("ACCOUNT HOLDER DETAILS")
    sections.append("=" * 88)
    sections.append(f"Name                     : {user.name}")
    sections.append(f"Email                    : {user.email}")
    sections.append(f"Report Generated At      : {to_ist_string(utc_now())}")
    sections.append(f"Last Check-in Time       : {to_ist_string(user.last_check_in)}")
    sections.append("")
    sections.append(f"We're not sure whether something happened to {user.name} after the last check in time")
    sections.append("We convey our deep condolences if he's/she's no more")
    sections.append("")

    sections.append("=" * 88)
    sections.append("FINANCIAL SUMMARY")
    sections.append("=" * 88)
    sections.append(f"Total Amount in Debt     : {money(total_debt)}")
    sections.append(f"Total Money Owed To Me   : {money(total_owed_to_me)}")
    sections.append(f"Total Assets / Value     : {money(total_assets)}")
    sections.append(f"Total Records Entered    : {len(records)}")
    sections.append("")

    sections.append("=" * 88)
    sections.append("DASHBOARD INTELLIGENCE")
    sections.append("=" * 88)
    if intel["highest_debt"]:
        sections.append(f"Highest Liability        : {intel['highest_debt']['title']} ({money(intel['highest_debt']['amount'])})")
    else:
        sections.append("Highest Liability        : None recorded")
    if intel["highest_owed"]:
        sections.append(f"Largest Receivable       : {intel['highest_owed']['title']} ({money(intel['highest_owed']['amount'])})")
    else:
        sections.append("Largest Receivable       : None recorded")
    if intel["strongest_asset"]:
        sections.append(f"Strongest Asset          : {intel['strongest_asset']['title']} ({money(intel['strongest_asset']['amount'])})")
    else:
        sections.append("Strongest Asset          : None recorded")
    sections.append("")

    sections.append("=" * 88)
    sections.append("PERSONAL LAST MESSAGE")
    sections.append("=" * 88)
    if user.last_message and user.last_message.strip():
        sections.append(user.last_message.strip())
    else:
        sections.append("No personal last message was saved by the account holder.")
    sections.append("")

    sections.append("=" * 88)
    sections.append("TRUSTED CONTACTS")
    sections.append("=" * 88)
    if contacts:
        for index, contact in enumerate(contacts, start=1):
            sections.append(f"Contact {index}")
            sections.append(f"  Name                 : {contact.name}")
            sections.append(f"  Relationship         : {contact.relationship_name or 'Not provided'}")
            sections.append(f"  Email                : {contact.email or 'Not provided'}")
            sections.append(f"  Phone                : {contact.phone or 'Not provided'}")
            sections.append("-" * 88)
    else:
        sections.append("No trusted contacts available.")
        sections.append("")

    sections.append("=" * 88)
    sections.append("DETAILED RECORDS")
    sections.append("=" * 88)
    if records:
        for category, items in grouped.items():
            category_total = sum(safe_amount(item.amount) for item in items)
            sections.append(f"Category               : {category}")
            sections.append(f"Category Total         : {money(category_total)}")
            sections.append("-" * 88)
            for index, item in enumerate(items, start=1):
                sections.append(f"Entry {index}")
                sections.append(f"  Title / Item Name    : {item.title or 'Not provided'}")
                sections.append(f"  Amount               : {money(safe_amount(item.amount))}")
                sections.append(f"  Person / Institution : {item.owner or 'Not provided'}")
                sections.append(f"  Details / Notes      : {item.details or 'No details provided'}")
                sections.append("")
            sections.append("=" * 88)
    else:
        sections.append("No records were found in the database.")
        sections.append("")

    sections.append("IMPORTANT NOTE")
    sections.append("-" * 88)
    sections.append("This report was automatically generated by the Death Note system.")
    sections.append("Please verify all details carefully before making any decisions or contacting institutions.")
    sections.append("")
    sections.append("Take care of all these things mentioned above after my death buddy.")
    sections.append("I loved you guys always❣️, sorry for leaving y'all 🥺")

    return "\n".join(sections)


def release_message(user: User) -> tuple[str, str, str]:
    subject = f"Death Note emergency report for {user.name}"
    body = (
        f"This is an emergency release notification for {user.name}.\n\n"
        f"A readable Death Note emergency report is attached to this email.\n"
        f"Generated at: {to_ist_string(utc_now())}\n"
    )
    filename = f"death_note_report_user_{user.id}.txt"
    return subject, body, filename


def run_release(user: User, db: Session) -> dict:
    contacts = db.query(TrustedContact).filter(TrustedContact.user_id == user.id).all()
    if not contacts:
        raise HTTPException(status_code=400, detail="Add at least one trusted contact before triggering the release")

    records = db.query(Record).filter(Record.user_id == user.id).all()
    if not records:
        raise HTTPException(status_code=400, detail="No records available. Add records first.")

    recipients = [contact.email for contact in contacts if contact.email]
    if not recipients:
        raise HTTPException(status_code=400, detail="Trusted contacts do not have valid email addresses")

    report_text = build_emergency_report(user, contacts, db)
    subject, email_body, report_filename = release_message(user)

    try:
        sent, delivery_message = send_emergency_email(
            recipients,
            subject,
            email_body,
            attachment_name=report_filename,
            attachment_content=report_text,
        )
    except Exception as exc:
        sent, delivery_message = False, str(exc)

    preview_path = OUTBOX_DIR / f"trigger_user_{user.id}_{int(time.time())}.txt"
    preview_path.write_text(
        f"Recipients: {', '.join(recipients)}\n\n"
        f"Subject: {subject}\n\n"
        f"{email_body}\n\n"
        f"ATTACHED REPORT CONTENT:\n\n{report_text}",
        encoding="utf-8",
    )

    user.is_triggered = True
    db.commit()
    db.refresh(user)

    if sent:
        message = f"Emergency release sent to {len(recipients)} trusted contact(s)."
    else:
        message = (
            f"Emergency release prepared, but email was not sent because {delivery_message}. "
            f"A preview file was saved to backend/outbox."
        )

    return {
        "message": message,
        "trusted_contacts": recipients,
        "preview_file": preview_path.name,
        "last_check_in": as_api_datetime_string(user.last_check_in),
        "is_triggered": user.is_triggered,
        "warning_sent": user.warning_sent,
    }


def seconds_since_check_in(user: User) -> int:
    base_time = ensure_utc(user.last_check_in)
    if base_time is None:
        return 0
    return max(0, int((utc_now() - base_time).total_seconds()))


def check_auto_triggers_once():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        for user in users:
            records_exist = db.query(Record).filter(Record.user_id == user.id).first() is not None
            if not records_exist:
                continue

            seconds_since = seconds_since_check_in(user)

            if not user.warning_sent and WARNING_THRESHOLD_SECONDS <= seconds_since < TRIGGER_THRESHOLD_SECONDS:
                try:
                    sent, delivery = send_warning_email(user)
                    user.warning_sent = True
                    db.commit()
                    warning_path = OUTBOX_DIR / f"warning_user_{user.id}_{int(time.time())}.txt"
                    warning_path.write_text(
                        f"Warning email target: {user.email}\n"
                        f"Status: {'sent' if sent else 'not sent'}\n"
                        f"Reason: {delivery}\n"
                        f"Generated at: {to_ist_string(utc_now())}\n"
                        f"User: {user.email}\n",
                        encoding='utf-8'
                    )
                except Exception:
                    db.rollback()

            if user.is_triggered:
                continue
            if seconds_since >= TRIGGER_THRESHOLD_SECONDS:
                try:
                    run_release(user, db)
                except HTTPException:
                    db.rollback()
                except Exception:
                    db.rollback()
    finally:
        db.close()


def auto_trigger_worker():
    while True:
        try:
            check_auto_triggers_once()
        except Exception:
            pass
        time.sleep(max(1, AUTOTRIGGER_POLL_SECONDS))


@app.on_event("startup")
def startup_event():
    worker = threading.Thread(target=auto_trigger_worker, daemon=True)
    worker.start()


@app.get("/")
def read_root():
    return {
        "message": "Death Note backend is running",
        "trigger_threshold_seconds": TRIGGER_THRESHOLD_SECONDS,
        "warning_threshold_seconds": WARNING_THRESHOLD_SECONDS,
    }


@app.post("/register", response_model=UserResponse)
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


@app.post("/login", response_model=UserResponse)
def login_user(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or user.password_hash != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return user


@app.get("/users", response_model=list[UserResponse])
def get_users(db: Session = Depends(get_db)):
    return db.query(User).all()


@app.put("/users/{user_id}/last-message", response_model=LastMessageResponse)
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


@app.post("/check-in/{user_id}")
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


@app.get("/trigger-status/{user_id}")
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


@app.get("/contacts/{user_id}", response_model=list[TrustedContactResponse])
def get_contacts(user_id: int, db: Session = Depends(get_db)):
    return db.query(TrustedContact).filter(TrustedContact.user_id == user_id).all()


@app.post("/contacts/{user_id}", response_model=TrustedContactResponse)
def create_contact(user_id: int, contact: TrustedContactCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_contact = TrustedContact(
        user_id=user_id,
        name=contact.name,
        email=contact.email,
        phone=contact.phone,
        relationship_name=contact.relationship,
    )
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return new_contact


@app.put("/contacts/{contact_id}", response_model=TrustedContactResponse)
def update_contact(contact_id: int, contact: TrustedContactUpdate, db: Session = Depends(get_db)):
    existing = db.query(TrustedContact).filter(TrustedContact.id == contact_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Contact not found")

    existing.name = contact.name
    existing.email = contact.email
    existing.phone = contact.phone
    existing.relationship_name = contact.relationship
    db.commit()
    db.refresh(existing)
    return existing


@app.delete("/contacts/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    existing = db.query(TrustedContact).filter(TrustedContact.id == contact_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Contact not found")

    db.delete(existing)
    db.commit()
    return {"message": "Contact deleted"}


@app.get("/records/{user_id}", response_model=list[RecordResponse])
def get_records(user_id: int, db: Session = Depends(get_db)):
    return db.query(Record).filter(Record.user_id == user_id).order_by(Record.id.desc()).all()


@app.post("/records/{user_id}", response_model=RecordResponse)
def create_record(user_id: int, record: RecordCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_record = Record(
        user_id=user_id,
        title=record.title,
        category=record.category,
        amount=record.amount,
        owner=record.owner,
        details=record.details,
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record


@app.put("/records/{record_id}", response_model=RecordResponse)
def update_record(record_id: int, record: RecordUpdate, db: Session = Depends(get_db)):
    existing = db.query(Record).filter(Record.id == record_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Record not found")

    existing.title = record.title
    existing.category = record.category
    existing.amount = record.amount
    existing.owner = record.owner
    existing.details = record.details
    db.commit()
    db.refresh(existing)
    return existing


@app.delete("/records/{record_id}")
def delete_record(record_id: int, db: Session = Depends(get_db)):
    existing = db.query(Record).filter(Record.id == record_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Record not found")

    db.delete(existing)
    db.commit()
    return {"message": "Record deleted"}


@app.post("/simulate-trigger/{user_id}")
def simulate_trigger(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return run_release(user, db)
