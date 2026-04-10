import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import Base, engine
from api.routes import users, records, contacts, trigger
from services.trigger_engine import auto_trigger_worker
from core.config import TRIGGER_THRESHOLD_SECONDS, WARNING_THRESHOLD_SECONDS

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Death Note Backend",
    description="Refactored modular backend for Death Note.",
)

# Setup CORS
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

# Connect Routers
app.include_router(users.router, tags=["users"])
app.include_router(records.router, tags=["records"])
app.include_router(contacts.router, tags=["contacts"])
app.include_router(trigger.router, tags=["trigger"])

@app.on_event("startup")
def startup_event():
    # Start the daemon thread for evaluating auto-triggers
    worker = threading.Thread(target=auto_trigger_worker, daemon=True)
    worker.start()

@app.get("/", tags=["health"])
def read_root():
    return {
        "message": "Death Note backend is running",
        "trigger_threshold_seconds": TRIGGER_THRESHOLD_SECONDS,
        "warning_threshold_seconds": WARNING_THRESHOLD_SECONDS,
    }
