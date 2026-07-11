import pytest
import os
import sys
from main import app
from database import get_db

# Append current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

@pytest.fixture(autouse=True)
def dynamic_db_override(request):
    """
    Dynamically overrides get_db for the active test module,
    preventing cross-test database collisions when tests run in the same session.
    """
    module = request.module
    if module and hasattr(module, "TestingSessionLocal"):
        session_local = getattr(module, "TestingSessionLocal")
        
        def override_get_db_dynamic():
            db = session_local()
            try:
                yield db
            except Exception:
                db.rollback()
                raise
            finally:
                db.rollback()
                db.close()
                
        app.dependency_overrides[get_db] = override_get_db_dynamic
        yield
        # Restore standard behavior
        app.dependency_overrides.pop(get_db, None)
    else:
        yield
