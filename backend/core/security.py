import bcrypt
import hashlib
import base64
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

def hash_password(password: str) -> str:
    # Pre-hash with SHA256 to bypass bcrypt's 72-byte limit
    # This ensures consistent input length (32 bytes) for bcrypt
    pw_hash = hashlib.sha256(password.encode("utf-8")).digest()
    pw_hash_b64 = base64.b64encode(pw_hash)
    
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pw_hash_b64, salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pw_hash = hashlib.sha256(plain_password.encode("utf-8")).digest()
        pw_hash_b64 = base64.b64encode(pw_hash)
        return bcrypt.checkpw(pw_hash_b64, hashed_password.encode("utf-8"))
    except Exception:
        # Gracefully handle invalid formats or legacy hashes
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_password_reset_token(email: str, password_hash: str):
    # Use password_hash as part of the secret to ensure it's one-time use
    reset_secret = SECRET_KEY + password_hash
    expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode = {"sub": email, "exp": expire}
    return jwt.encode(to_encode, reset_secret, algorithm=ALGORITHM)


def verify_password_reset_token(token: str, password_hash: str) -> Optional[str]:
    reset_secret = SECRET_KEY + password_hash
    try:
        payload = jwt.decode(token, reset_secret, algorithms=[ALGORITHM])
        return payload.get("sub")
    except Exception:
        return None
