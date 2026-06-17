import os
import pytz
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Core Configuration Settings
IST = pytz.timezone("Asia/Kolkata")
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set. Please check your .env file.")

DATABASE_URL = DATABASE_URL.strip()
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

TRIGGER_THRESHOLD_SECONDS = int(os.getenv("TRIGGER_THRESHOLD_SECONDS", "7776000"))
WARNING_THRESHOLD_SECONDS = int(os.getenv("WARNING_THRESHOLD_SECONDS", "5184000"))
AUTOTRIGGER_POLL_SECONDS = int(os.getenv("AUTOTRIGGER_POLL_SECONDS", "5"))

# JWT Security Settings
SECRET_KEY = os.getenv("SECRET_KEY", "7b04870f058098c1995817c1809087c1809087c1809087c18090")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 # 1 hour

# CORS Settings
CORS_ORIGINS_RAW = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ORIGINS_RAW.split(",") if origin.strip()]

# Helper to strip quotes and whitespace
def _clean_env(val: str | None) -> str | None:
    if val is None:
        return None
    val = val.strip()
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        val = val[1:-1].strip()
    return val

# Twilio Settings
TWILIO_ACCOUNT_SID = _clean_env(os.getenv("TWILIO_ACCOUNT_SID"))
TWILIO_AUTH_TOKEN = _clean_env(os.getenv("TWILIO_AUTH_TOKEN"))
TWILIO_FROM_NUMBER = _clean_env(os.getenv("TWILIO_FROM_NUMBER"))
