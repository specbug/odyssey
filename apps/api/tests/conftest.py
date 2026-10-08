"""Point the app at a throwaway SQLite DB and upload dir before it's imported.

`app.database` builds its engine from DATABASE_URL at import time and
`app.main` creates UPLOAD_DIR on import, so the env has to be set here,
before any test module imports them.
"""
import os
import shutil
import tempfile

import pytest

_TMP = tempfile.mkdtemp(prefix="odyssey-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/test.db"
os.environ["UPLOAD_DIR"] = os.path.join(_TMP, "uploads")
os.environ.pop("META_API_KEY", None)
os.environ.pop("HEALTHCHECKS_URL", None)


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(_TMP, ignore_errors=True)


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.database import SessionLocal
    from app.main import app
    from app.models import PDFFile

    with TestClient(app) as c:
        yield c

    db = SessionLocal()
    try:
        for f in db.query(PDFFile).all():
            if f.file_path and os.path.exists(f.file_path):
                os.remove(f.file_path)
            db.delete(f)
        db.commit()
    finally:
        db.close()
