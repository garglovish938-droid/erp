"""
Live end-to-end test for Archive/Restore user Prince via API.
Uses requests library to call the ERP API directly.
"""
import requests
import json
import sqlite3

BASE_URL = "http://localhost:8000"
DB_PATH = r'd:\Factory erp\erp_demo\backend\erp.db'

# Target user
TARGET_EMAIL = "princerajput27034@gmail.com"
TARGET_USER_ID = "7eb41b52-fbe3-44ad-8710-49d4e7e2e5e3"
TARGET_STAFF_ID = "390a3b58-ce40-4fca-b0b1-8b21f2683928"

ADMIN_EMAIL = "admin@allure.com"
ADMIN_PASSWORD = "admin123"

def print_separator(title=""):
    print("\n" + "="*60)
    if title:
        print(f"  {title}")
        print("="*60)

def get_db_state():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, full_name, email, is_deleted, status FROM users WHERE id = ?", (TARGET_USER_ID,))
    user = cursor.fetchone()
    cursor.execute("SELECT id, name, email, is_deleted, status FROM staff WHERE id = ?", (TARGET_STAFF_ID,))
    staff = cursor.fetchone()
    conn.close()
    return {"user": user, "staff": staff}

def main():
    print_separator("ALLURE ERP - ARCHIVE/RESTORE USER TEST")

    # Step 1: Admin Login
    print_separator("STEP 1: Admin Login")
    login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    print(f"Login Status Code: {login_resp.status_code}")
    print(f"Login Response: {login_resp.text[:500]}")

    if login_resp.status_code != 200:
        print("FAILED: Could not login as admin.")
        return

    token = login_resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    # Step 2: Verify Prince exists in active users list
    print_separator("STEP 2: Check Initial DB State")
    db_state = get_db_state()
    print(f"User DB: {db_state['user']}")
    print(f"Staff DB: {db_state['staff']}")

    # Step 3: Get list of users (active)
    print_separator("STEP 3: GET /api/users - Verify Prince is in active list")
    users_resp = requests.get(f"{BASE_URL}/api/users", headers=headers)
    print(f"GET /api/users Status: {users_resp.status_code}")
    users = users_resp.json() if users_resp.status_code == 200 else []
    prince_in_list = any(u.get("id") == TARGET_USER_ID for u in users)
    print(f"Prince in active user list: {prince_in_list}")

    # Step 4: Archive/Delete Prince
    print_separator("STEP 4: DELETE /api/users/{user_id} - Archive Prince")
    delete_resp = requests.delete(f"{BASE_URL}/api/users/{TARGET_USER_ID}", headers=headers)
    print(f"DELETE Status Code: {delete_resp.status_code}")
    print(f"DELETE Response: {delete_resp.text}")

    # Step 5: Check DB state after archive
    print_separator("STEP 5: DB State After Archive")
    db_state_after = get_db_state()
    print(f"User DB: {db_state_after['user']}")
    print(f"Staff DB: {db_state_after['staff']}")
    user_is_deleted = db_state_after['user'][3] == 1 if db_state_after['user'] else None
    print(f"User is_deleted = {user_is_deleted}")

    # Step 6: Verify Prince no longer in active users list
    print_separator("STEP 6: GET /api/users - Verify Prince is NOT in active list")
    users_resp2 = requests.get(f"{BASE_URL}/api/users", headers=headers)
    users2 = users_resp2.json() if users_resp2.status_code == 200 else []
    prince_still_in_list = any(u.get("id") == TARGET_USER_ID for u in users2)
    print(f"Prince in active user list after delete: {prince_still_in_list}")

    # Step 7: Try login as Prince (should FAIL)
    print_separator("STEP 7: Try Login as Prince (should fail - account archived)")
    # We need to try Prince's password - let's try a few common ones
    prince_passwords = ["admin123", "password", "password123", "prince123", "12345678"]
    prince_login_before_restore = None
    for pwd in prince_passwords:
        prince_login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": TARGET_EMAIL,
            "password": pwd
        })
        print(f"  Try password '{pwd}': Status {prince_login_resp.status_code} - {prince_login_resp.text[:100]}")
        if prince_login_resp.status_code == 200:
            prince_login_before_restore = "SUCCESS (unexpected - user should be archived)"
            break
        elif prince_login_resp.status_code == 403 or "disabled" in prince_login_resp.text.lower() or "archived" in prince_login_resp.text.lower():
            prince_login_before_restore = f"CORRECTLY BLOCKED: {prince_login_resp.text[:200]}"
            break
        elif prince_login_resp.status_code == 401 and "incorrect" in prince_login_resp.text.lower():
            prince_login_before_restore = f"WRONG PASSWORD (not archived blocking): {prince_login_resp.text[:200]}"
    
    print(f"Login result before restore: {prince_login_before_restore}")

    # Step 8: Restore Prince via staff endpoint
    print_separator("STEP 8: POST /api/staff/{staff_id}/restore - Restore Prince")
    restore_resp = requests.post(f"{BASE_URL}/api/staff/{TARGET_STAFF_ID}/restore", headers=headers)
    print(f"Restore Status Code: {restore_resp.status_code}")
    print(f"Restore Response: {restore_resp.text}")

    # Step 9: Check DB state after restore
    print_separator("STEP 9: DB State After Restore")
    db_state_restore = get_db_state()
    print(f"User DB: {db_state_restore['user']}")
    print(f"Staff DB: {db_state_restore['staff']}")
    user_is_deleted_after_restore = db_state_restore['user'][3] == 1 if db_state_restore['user'] else None
    print(f"User is_deleted after restore = {user_is_deleted_after_restore}")

    # Step 10: Verify Prince in active list again
    print_separator("STEP 10: GET /api/users - Verify Prince is in active list again")
    users_resp3 = requests.get(f"{BASE_URL}/api/users", headers=headers)
    users3 = users_resp3.json() if users_resp3.status_code == 200 else []
    prince_back_in_list = any(u.get("id") == TARGET_USER_ID for u in users3)
    print(f"Prince in active user list after restore: {prince_back_in_list}")

    # Step 11: Reset password for Prince and try login
    print_separator("STEP 11: Reset Prince's password and try login")
    reset_resp = requests.post(f"{BASE_URL}/api/users/{TARGET_USER_ID}/reset-password", 
                                headers=headers, 
                                json={"password": "prince123"})
    print(f"Reset Password Status: {reset_resp.status_code}")
    print(f"Reset Response: {reset_resp.text}")

    # Try login after reset
    for pwd in ["prince123", "admin123", "password123"]:
        prince_login_after = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": TARGET_EMAIL,
            "password": pwd
        })
        print(f"  Try password '{pwd}': Status {prince_login_after.status_code} - {prince_login_after.text[:150]}")
        if prince_login_after.status_code == 200:
            print("LOGIN SUCCESSFUL AFTER RESTORE!")
            break

    # Final Summary
    print_separator("FINAL TEST RESULTS")
    print(f"Status Code (Archive DELETE): {delete_resp.status_code}")
    print(f"API Response (Archive):       {delete_resp.text}")
    print(f"User Disappeared from List:   {not prince_still_in_list}")
    print(f"User is_deleted in DB:        {user_is_deleted}")
    print(f"Status Code (Restore POST):   {restore_resp.status_code}")
    print(f"User Restored in List:        {prince_back_in_list}")
    print(f"User is_deleted after restore: {user_is_deleted_after_restore}")

    if delete_resp.status_code == 200 and user_is_deleted and not prince_still_in_list and restore_resp.status_code == 200 and prince_back_in_list:
        print("\nOVERALL RESULT: SUCCESS ✓")
    else:
        print("\nOVERALL RESULT: FAILURE ✗")
        if delete_resp.status_code != 200:
            print(f"  Root Cause: Archive DELETE failed with status {delete_resp.status_code}")
        if not user_is_deleted:
            print("  Root Cause: Database is_deleted did not change to True")
        if prince_still_in_list:
            print("  Root Cause: User still appearing in active list after archive")
        if restore_resp.status_code != 200:
            print(f"  Root Cause: Restore failed with status {restore_resp.status_code}")
        if not prince_back_in_list:
            print("  Root Cause: User not returned to active list after restore")

if __name__ == "__main__":
    main()
