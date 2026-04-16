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
