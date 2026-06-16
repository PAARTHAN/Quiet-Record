import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv
import logging

load_dotenv()

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

logger = logging.getLogger(__name__)

fernet = None
if ENCRYPTION_KEY:
    try:
        fernet = Fernet(ENCRYPTION_KEY.encode())
    except Exception as e:
        logger.error(f"Failed to initialize Fernet with provided ENCRYPTION_KEY: {e}")

def encrypt_detail(text: str | None) -> str | None:
    """Encrypts a plaintext string. Returns the encrypted string or the original if no key/text."""
    if not text or not fernet:
        return text
    
    try:
        encrypted_bytes = fernet.encrypt(text.encode('utf-8'))
        return encrypted_bytes.decode('utf-8')
    except Exception as e:
        logger.error(f"Failed to encrypt text: {e}")
        return text

def decrypt_detail(encrypted_text: str | None) -> str | None:
    """Decrypts a string. Falls back to original text if decryption fails (e.g. old plaintext records)."""
    if not encrypted_text or not fernet:
        return encrypted_text
    
    try:
        decrypted_bytes = fernet.decrypt(encrypted_text.encode('utf-8'))
        return decrypted_bytes.decode('utf-8')
    except Exception as e:
        # If decryption fails, we assume it's an old plaintext record and return it as is.
        return encrypted_text
