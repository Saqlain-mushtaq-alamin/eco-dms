from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union
from pydantic import field_validator


class Settings(BaseSettings):
    # App Settings
    APP_ENV: str = "dev"
    SECRET_KEY: str = "change_me_dev_long_random"
    SESSION_COOKIE_NAME: str = "eco_dms_session"
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    MOBILE_ORIGIN: str = "exp://127.0.0.1:8081"

    # Pinata / IPFS
    PINATA_JWT: str = ""
    IPFS_API_URL: str = ""
    IPFS_GATEWAY_URL: str = "https://gateway.pinata.cloud/ipfs/"

    # JWT
    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production-12345"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440

    # CORS
    ALLOWED_ORIGINS: Union[str, List[str]] = ["http://localhost:3000", "http://localhost:5173"]

    # API
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Eco-DMS Decentralized"

    # Blockchain
    CHAIN_ID: int = 1

    # Redis
    REDIS_URL: str = "redis://127.0.0.1:6379/0"
    NONCE_TTL_SECONDS: int = 300
    SESSION_TTL_SECONDS: int = 3600
    RATE_LIMIT_WINDOW_SEC: int = 60
    RATE_LIMIT_MAX_NONCE: int = 20
    RATE_LIMIT_MAX_VERIFY: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except:
                    pass
            if "," in v:
                return [i.strip().strip('"').strip("'") for i in v.split(",")]
            return [v] if v else []
        return v


settings = Settings()
