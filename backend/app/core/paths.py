from pathlib import Path

# Project paths
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BACKEND_DIR / "data"
MODELS_DIR = BACKEND_DIR / "models"
UPLOADS_DIR = BACKEND_DIR / "uploads"

DATA_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

DATABASE_URL = f"sqlite:///{DATA_DIR / 'civicpulse.db'}"
DEMO_EMAIL_LOG = DATA_DIR / "emails_sent.log"
DEMO_SMS_LOG = DATA_DIR / "sms_sent.log"