import os
import pytz

# Core Configuration Settings

IST = pytz.timezone("Asia/Kolkata")
TRIGGER_THRESHOLD_SECONDS = int(os.getenv("TRIGGER_THRESHOLD_SECONDS", "30"))
WARNING_THRESHOLD_SECONDS = int(os.getenv("WARNING_THRESHOLD_SECONDS", "15"))
AUTOTRIGGER_POLL_SECONDS = int(os.getenv("AUTOTRIGGER_POLL_SECONDS", "1"))
