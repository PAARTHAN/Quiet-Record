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

TRIGGER_THRESHOLD_SECONDS = int(os.getenv("TRIGGER_THRESHOLD_SECONDS", "30"))
WARNING_THRESHOLD_SECONDS = int(os.getenv("WARNING_THRESHOLD_SECONDS", "15"))
AUTOTRIGGER_POLL_SECONDS = int(os.getenv("AUTOTRIGGER_POLL_SECONDS", "5"))

# JWT Security Settings
SECRET_KEY = os.getenv("SECRET_KEY", "7b04870f058098c1995817c1809087c1809087c1809087c18090")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 # 1 hour

# CORS Settings
CORS_ORIGINS_RAW = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ORIGINS_RAW.split(",") if origin.strip()]

# Twilio Settings
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER")
