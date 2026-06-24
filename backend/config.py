import os

class Settings:
    PROJECT_NAME: str = "Allure Living ERP"
    VERSION: str = "1.0.0"

    # Database configuration: supports Postgres (production) and SQLite (local dev)
    # In production (Railway), DATABASE_URL is injected automatically by the PostgreSQL plugin.
    # SQLAlchemy 2.0 requires 'postgresql://' instead of 'postgres://'
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./erp.db"
    ).replace("postgres://", "postgresql://", 1)

    # JWT security settings — ALWAYS override SECRET_KEY via environment variable in production!
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    
    # Run safety checks
    if not SECRET_KEY:
        db_url = os.getenv("DATABASE_URL", "")
        if "postgres" in db_url or os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("ENVIRONMENT") == "production":
            raise ValueError("CRITICAL SECURITY ERROR: SECRET_KEY environment variable MUST be set in production environments!")
        SECRET_KEY = "allure_living_super_secret_key_123456789"
        
    ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 600

    # File storage paths — relative by default, override via env vars in production
    BACKUP_DIR: str = os.getenv("BACKUP_DIR", "./backups")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")

settings = Settings()
