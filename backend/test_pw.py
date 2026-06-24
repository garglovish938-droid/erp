import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import auth
from database import SessionLocal
from models import User

db = SessionLocal()
try:
    user = db.query(User).filter(User.email == "admin@allure.com").first()
    if user:
        print(f"User found: {user.email}")
        passwords = ["admin123", "Admin@1234", "admin", "admin@123", "admin1234", "Admin123", "Admin123!"]
        for pw in passwords:
            is_valid = auth.verify_password(pw, user.password_hash)
            print(f"Password '{pw}': {is_valid}")
    else:
        print("User admin@allure.com not found in DB.")
finally:
    db.close()
