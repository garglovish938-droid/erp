import os

def load_dotenv():
    # Load settings from local env files if present
    env_paths = [".env", "../.env", "backend/.env", ".env.local"]
    for path in env_paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip()
                            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                                v = v[1:-1]
                            os.environ.setdefault(k, v)
            except Exception as e:
                print(f"Error loading {path}: {e}")

load_dotenv()


class Settings:
    PROJECT_NAME: str = "Allure Living ERP"
    VERSION: str = "1.0.0"
    _base_dir = os.path.dirname(os.path.abspath(__file__))
    _default_db = f"sqlite:///{os.path.join(_base_dir, 'erp.db')}"

    def __init__(self):
        self.DATABASE_URL: str = os.getenv(
            "DATABASE_URL",
            self._default_db
        ).replace("postgres://", "postgresql://", 1)

        self.ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower()
        self.SECRET_KEY: str = os.getenv("SECRET_KEY", "")
        
        if self.ENVIRONMENT == "production" or os.getenv("RAILWAY_ENVIRONMENT"):
            if not self.SECRET_KEY or self.SECRET_KEY == "allure_living_super_secret_key_123456789":
                raise ValueError("SECRET_KEY environment variable must be set in production to secure JWT signatures.")
            if self.DATABASE_URL.startswith("sqlite"):
                raise ValueError("DATABASE_URL must be a PostgreSQL connection string in production environments.")
        else:
            if not self.SECRET_KEY:
                self.SECRET_KEY = "allure_living_super_secret_key_123456789"
            
        self.ALGORITHM: str = "HS256"
        self.ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
        self.BACKUP_DIR: str = os.getenv("BACKUP_DIR", "./backups")
        self.UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
        self.STORAGE_PROVIDER: str = os.getenv("STORAGE_PROVIDER", "local").lower()
        self.SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
        self.SUPABASE_KEY: str = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
        self.LANGFLOW_API_URL: str = os.getenv("LANGFLOW_API_URL", "")
        self.LANGFLOW_FLOW_ID: str = os.getenv("LANGFLOW_FLOW_ID", "")
        self.LANGFLOW_API_KEY: str = os.getenv("LANGFLOW_API_KEY", "")
        self.LANGFLOW_MODE: str = os.getenv("LANGFLOW_MODE", "emulator").lower()
        self.SMTP_SERVER: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
        self.SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
        self.SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
        self.SMTP_FROM: str = os.getenv("SMTP_FROM", "nexora_ai@allure.com")
        self.GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
        self.N8N_WEBHOOK_URL: str = os.getenv("N8N_WEBHOOK_URL", "")
        self.REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.OLLAMA_URL: str = os.getenv("OLLAMA_URL", "https://712a881f73c6edcd-223-185-59-189.serveousercontent.com/api/generate")
        self.OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5")

settings = Settings()
