import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    APP_ENV: str = os.getenv("APP_ENV", "dev")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "insecure_dev_key")
    SESSION_COOKIE_NAME: str = os.getenv("SESSION_COOKIE_NAME", "eco_session")
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    MOBILE_ORIGIN: str = os.getenv("MOBILE_ORIGIN", "http://localhost:19000")
    CORS_ORIGINS: list[str] = [FRONTEND_ORIGIN, MOBILE_ORIGIN]
    NONCE_TTL_SECONDS: int = 300
    SESSION_TTL_SECONDS: int = 3600

settings = Settings()