from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "CivicPulse"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "civicpulse@demo.local"
    EMAIL_USE_TLS: bool = True
    EMAIL_MOCK: bool = True

    # Vision model
    VISION_MODEL_ENABLED: bool = False
    VISION_MODEL_PATH: str = "yolov8n.pt"
    VISION_CONF_THRESHOLD: float = 0.35

    # Exotel voice helpline
    EXOTEL_MOCK: bool = True
    EXOTEL_SID: str = ""
    EXOTEL_API_KEY: str = ""
    EXOTEL_API_TOKEN: str = ""
    EXOTEL_APP_ID: str = ""
    EXOTEL_CONTACT_NUMBER: str = "+9190000 00000"  # number citizens dial

    # Embeddings
    EMBEDDINGS_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDINGS_ENABLED: bool = False

    # Demo
    DEMO_MODE: bool = True


settings = Settings()