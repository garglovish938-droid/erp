import os
import sys
import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Settings

def test_production_security_enforcement(monkeypatch):
    # 1. Test missing SECRET_KEY in production raises ValueError
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "")
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
    
    with pytest.raises(ValueError) as excinfo:
        Settings()
    assert "SECRET_KEY environment variable must be set in production" in str(excinfo.value)

    # 2. Test default SECRET_KEY in production raises ValueError
    monkeypatch.setenv("SECRET_KEY", "allure_living_super_secret_key_123456789")
    with pytest.raises(ValueError) as excinfo:
        Settings()
    assert "SECRET_KEY environment variable must be set in production" in str(excinfo.value)

    # 3. Test SQLite DATABASE_URL in production raises ValueError
    monkeypatch.setenv("SECRET_KEY", "my_real_production_secret_key_12345")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///erp.db")
    with pytest.raises(ValueError) as excinfo:
        Settings()
    assert "DATABASE_URL must be a PostgreSQL connection string in production" in str(excinfo.value)

def test_development_defaults(monkeypatch):
    # 4. Test development allows defaults and SQLite
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SECRET_KEY", "")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///erp.db")
    
    settings = Settings()
    assert settings.SECRET_KEY == "allure_living_super_secret_key_123456789"
    assert settings.DATABASE_URL == "sqlite:///erp.db"
