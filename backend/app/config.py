"""Configurazione del CONTROLLER, letta da variabili d'ambiente (docker-compose)."""
import os


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://smartmobility:secret@db:5432/smartmobility",
    )
    JWT_SECRET: str = os.getenv("JWT_SECRET", "changeme-in-production")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 giorni

    # [DA VERIFICARE] Client ID OAuth: se valorizzati, i token social vengono verificati
    # davvero presso il provider; altrimenti l'endpoint social resta in modalità fidata/stub.
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    FACEBOOK_APP_ID: str = os.getenv("FACEBOOK_APP_ID", "")
    FACEBOOK_APP_SECRET: str = os.getenv("FACEBOOK_APP_SECRET", "")


settings = Settings()
