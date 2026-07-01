import os

class Settings:
    PROJECT_NAME: str = "Allure Living ERP"
    VERSION: str = "1.0.0"

    # Database configuration: supports Postgres (production) and SQLite (local dev)
    # In production (Railway), DATABASE_URL is injected automatically by the PostgreSQL plugin.
    # SQLAlchemy 2.0 requires 'postgresql://' instead of 'postgres://'
    _base_dir = os.path.dirname(os.path.abspath(__file__))
    _default_db = f"sqlite:///{os.path.join(_base_dir, 'erp.db')}"
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        _default_db
    ).replace("postgres://", "postgresql://", 1)

    # JWT security settings — ALWAYS override SECRET_KEY via environment variable in production!
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    
    # Run safety checks
    if not SECRET_KEY:
        db_url = os.getenv("DATABASE_URL", "")
        if "postgres" in db_url or os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("ENVIRONMENT") == "production":
            print("WARNING: SECRET_KEY environment variable is not set. Falling back to default for production. THIS IS NOT SECURE FOR PRODUCTION!")
        SECRET_KEY = "allure_living_super_secret_key_123456789"
        
    ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # File storage paths — relative by default, override via env vars in production
    BACKUP_DIR: str = os.getenv("BACKUP_DIR", "./backups")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")

    # Supabase Storage settings
    STORAGE_PROVIDER: str = os.getenv("STORAGE_PROVIDER", "local").lower()
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

settings = Settings()

