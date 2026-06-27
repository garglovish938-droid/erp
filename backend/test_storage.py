import os
import sys
import unittest
from fastapi.testclient import TestClient

# Add parent directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import app
from config import settings
from storage import storage_provider, LocalStorageProvider, SupabaseStorageProvider

class TestStorageIntegration(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Create a test uploads folder if not exists
        os.makedirs(os.path.join(settings.UPLOAD_DIR, "test_fixtures"), exist_ok=True)
        self.test_file_path = os.path.join(settings.UPLOAD_DIR, "test_fixtures", "temp_test_card.txt")
        with open(self.test_file_path, "w") as f:
            f.write("STORAGE_MIGRATION_INTEGRATION_TEST_OK")

    def tearDown(self):
        if os.path.exists(self.test_file_path):
            os.remove(self.test_file_path)
        test_fixtures_dir = os.path.dirname(self.test_file_path)
        if os.path.exists(test_fixtures_dir) and not os.listdir(test_fixtures_dir):
            os.rmdir(test_fixtures_dir)

    def test_dynamic_serve_local_fallback(self):
        """Verify the dynamic GET /uploads/{path} route works in local fallback mode."""
        # Query our dynamic serve route
        response = self.client.get("/uploads/test_fixtures/temp_test_card.txt")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.text, "STORAGE_MIGRATION_INTEGRATION_TEST_OK")

    def test_storage_provider_upload_local(self):
        """Test the storage_provider interface directly."""
        test_data = b"HELLO_STORAGE_PROVIDER_LOCAL"
        test_filename = "direct_test_upload.txt"
        
        # Test direct upload via active provider
        db_path = storage_provider.upload_file(
            file_data=test_data,
            filename=test_filename,
            bucket="documents",
            mime_type="text/plain",
            subpath="test_fixtures"
        )
        
        # Verify the returned path format
        self.assertEqual(db_path, "/uploads/test_fixtures/direct_test_upload.txt")
        
        # Verify the file is accessible through our dynamic router
        response = self.client.get(db_path)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, test_data)
        
        # Cleanup uploaded test file
        local_uploaded_file = os.path.join(settings.UPLOAD_DIR, "test_fixtures", test_filename)
        if os.path.exists(local_uploaded_file):
            os.remove(local_uploaded_file)

if __name__ == "__main__":
    unittest.main()
