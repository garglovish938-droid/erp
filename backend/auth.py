from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import User
from schemas import TokenData

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt", "sha256_crypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

import bcrypt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False

import re

def get_password_hash(password: str) -> str:
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def validate_password_strength(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one digit")
    if not re.search(r"[@$!%*?&_#^()=+{}[\]|\\:;\"'<>,./?`~-]", password):
        raise ValueError("Password must contain at least one special character")
    return password

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        if email is None or role is None:
            raise credentials_exception
        token_data = TokenData(email=email, role=role)
    except jwt.PyJWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.email == token_data.email, User.is_deleted == False).first()
    if user is None:
        raise credentials_exception
    if user.status == "disabled":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled. Please contact Super Admin."
        )
    return user

class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(self.allowed_roles)}"
            )
        return current_user

# Predefined role helpers
ALL_ROLES = [
    "super_admin", "admin", "factory_manager", "project_manager", "inventory_manager",
    "purchase_manager", "hr_manager", "accounts_manager", "quality_inspector",
    "store_assistant", "machine_operator", "carpenter", "worker", "manager", "store", "accountant", "operator", "supervisor"
]

require_super_admin = RoleChecker(["super_admin"])
require_admin = RoleChecker(["admin", "super_admin"])
require_admin_or_factory_manager = RoleChecker(["admin", "super_admin", "factory_manager"])
require_project_edit_access = RoleChecker(["admin", "super_admin", "factory_manager", "project_manager", "manager", "supervisor"])
require_manager_or_higher = RoleChecker(["admin", "super_admin", "factory_manager", "project_manager", "manager", "supervisor"])
require_store_or_higher = RoleChecker(["admin", "super_admin", "factory_manager", "inventory_manager", "store_assistant", "manager", "store"])
require_accountant_or_higher = RoleChecker(["admin", "super_admin", "factory_manager", "accounts_manager", "accountant"])
require_report_access = RoleChecker(["admin", "super_admin", "factory_manager", "project_manager", "inventory_manager", "purchase_manager", "hr_manager", "accounts_manager", "manager", "store", "accountant", "supervisor"])
require_any_authenticated = RoleChecker(ALL_ROLES)
