import os
import smtplib
from email.message import EmailMessage

from db.models import User
from core.utils import to_ist_string, utc_now

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
