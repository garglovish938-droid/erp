"""
Temporary Password Reset Tool for Workflow Testing
This sets active employee passwords to password123 for testing, and can restore their hashes.
"""
import sqlite3
import sys

pwd_hashes = {
    'sonusharma28395@gmail.com': '$5$rounds=535000$RAls7ETeuCOsP0JJ$z4WOK9/7s3h5KxI85tAt9oOU2BXCrX4FjwxDTz/o3fB',
    'rajputsanju56898@gmail.com': '$5$rounds=535000$nLifOoII1YL/e8Mq$2gwvivTt8J52cBOWgUPdfkpAd3TETJdL8nk5HbkyslC',
    'allure@gmail.com': '$5$rounds=535000$35vGJ3T8aRREzGzG$S8PDcIKvcaswdYGHcLtU0dE1CPfwNJmfcUYF7prQIf5'
}

def set_temp_passwords():
    # Generate hash for "password123" using the same sha256_crypt schema
    from auth import pwd_context
    new_hash = pwd_context.hash("password123")
    
    conn = sqlite3.connect('./erp.db')
    c = conn.cursor()
    for email in pwd_hashes.keys():
        c.execute("UPDATE users SET password_hash=? WHERE email=?", (new_hash, email))
    conn.commit()
    conn.close()
    print("[+] Passwords set to temporary value: password123")

def restore_passwords():
    conn = sqlite3.connect('./erp.db')
    c = conn.cursor()
    for email, o_hash in pwd_hashes.items():
        c.execute("UPDATE users SET password_hash=? WHERE email=?", (o_hash, email))
    conn.commit()
    conn.close()
    print("[+] Original password hashes successfully restored")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "restore":
        restore_passwords()
    else:
        set_temp_passwords()
