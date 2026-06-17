import os
import smtplib
import json
import base64
import urllib.request
import urllib.error
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
    def clean_env_var(val: str | None) -> str | None:
        if val is None:
            return None
        val = val.strip()
        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
            val = val[1:-1].strip()
        return val

    resend_api_key = clean_env_var(os.getenv("RESEND_API_KEY"))
    resend_from = clean_env_var(os.getenv("RESEND_FROM_EMAIL")) or "emergency@galaxio.space"

    if resend_api_key:
        # Send via Resend HTTP API (Port 443, never blocked by Render)
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {resend_api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
        payload = {
            "from": resend_from,
            "to": recipients,
            "subject": subject,
            "text": body,
        }
        if attachment_name and attachment_content:
            content_b64 = base64.b64encode(attachment_content.encode("utf-8")).decode("utf-8")
            payload["attachments"] = [
                {
                    "filename": attachment_name,
                    "content": content_b64,
                }
            ]
        
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                return True, "Emails sent successfully via Resend API"
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8")
            return False, f"Resend API error: {e.code} - {err_msg}"
        except Exception as e:
            return False, f"Resend request failed: {str(e)}"

    smtp_host = clean_env_var(os.getenv("SMTP_HOST"))
    smtp_port = clean_env_var(os.getenv("SMTP_PORT"))
    smtp_username = clean_env_var(os.getenv("SMTP_USERNAME"))
    smtp_password = clean_env_var(os.getenv("SMTP_PASSWORD"))
    smtp_from_email = clean_env_var(os.getenv("SMTP_FROM_EMAIL")) or smtp_username
    
    use_tls_raw = clean_env_var(os.getenv("SMTP_USE_TLS")) or "true"
    use_tls = use_tls_raw.lower() == "true"

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

    with smtplib.SMTP(smtp_host, int(smtp_port), timeout=15) as server:
        if use_tls:
            server.starttls()
        if smtp_username and smtp_password:
            server.login(smtp_username, smtp_password)
        server.send_message(message)

    return True, "Emails sent successfully"


def send_warning_email(user: User) -> tuple[bool, str]:
    subject = f"Galaxio inactivity warning for {user.name}"
    body = (
        f"Hello {user.name},\n\n"
        f"We noticed that you have not checked in to the Galaxio application recently and we're not sure whether you're okay!.\n"
        f"This is a warning message sent to remind you to login and check-in.\n\n"
        f"If you are safe, please open the app and use the check-in action before the final trigger.\n\n"
        f"Warning generated at: {to_ist_string(utc_now())}\n"
    )
    return send_emergency_email([user.email], subject, body)


def send_password_reset_email(email: str, token: str) -> tuple[bool, str]:
    # In a real app, this would be a config variable
    base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{base_url}/reset-password?token={token}"
    
    subject = "Reset your Galaxio password"
    body = (
        f"Hi there,\n\n"
        f"You requested to reset your password for your Galaxio account.\n"
        f"Click the link below to set a new password. This link will expire in 15 minutes.\n\n"
        f"{reset_link}\n\n"
        f"If you didn't request this, you can safely ignore this email.\n\n"
        f"Best regards,\n"
        f"The Galaxio Team"
    )
    return send_emergency_email([email], subject, body)
