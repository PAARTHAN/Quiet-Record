import time
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.database import SessionLocal
from db.models import Record, TrustedContact, User
from core.config import WARNING_THRESHOLD_SECONDS, TRIGGER_THRESHOLD_SECONDS, AUTOTRIGGER_POLL_SECONDS
from core.utils import ensure_utc, to_ist_string, utc_now, as_api_datetime_string
from services.email_service import send_emergency_email, send_warning_email
from services.report_builder import build_emergency_report

# Use the same OUTBOX setup
OUTBOX_DIR = Path(__file__).resolve().parent.parent / "outbox"
OUTBOX_DIR.mkdir(exist_ok=True)

def seconds_since_check_in(user: User) -> int:
    base_time = ensure_utc(user.last_check_in)
    if base_time is None:
        return 0
    return max(0, int((utc_now() - base_time).total_seconds()))

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
                except Exception as e:
                    print(f"[Trigger Engine] Warning email failed for {user.email} - {str(e)}")
                    db.rollback()

            if user.is_triggered:
                continue
            if seconds_since >= TRIGGER_THRESHOLD_SECONDS:
                try:
                    run_release(user, db)
                except HTTPException as e:
                    print(f"[Trigger Engine] Skipping user {user.email} - {e.detail}")
                    db.rollback()
                except Exception as e:
                    print(f"[Trigger Engine] Unexpected failure for {user.email} - {str(e)}")
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
