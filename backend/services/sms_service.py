from twilio.rest import Client
from core.config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER

def send_emergency_sms(to_number: str, content: str) -> tuple[bool, str]:
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER):
        return False, "Twilio is not configured in .env"
    
    if not to_number:
        return False, "No phone number provided"

    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        # Twilio requires E.164 format (e.g., +91...)
        # We assume the user has entered it correctly or we could do some basic cleanup here
        clean_number = to_number.strip()
        if not clean_number.startswith('+'):
            # Default to +91 if code is missing, or just let Twilio error out if invalid
            # For robustness, we just use what's provided but ensuring it's stripped
            pass

        message = client.messages.create(
            body=content,
            from_=TWILIO_FROM_NUMBER,
            to=clean_number
        )
        return True, f"SMS sent successfully (SID: {message.sid})"
    except Exception as e:
        return False, f"Twilio Error: {str(e)}"
