import os, tempfile
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
import pytest
from fastapi.testclient import TestClient
from app import ai
from app.main import app
from app.database import Base, engine

@pytest.fixture(autouse=True)
def no_real_ai(monkeypatch):
    """Tests never call a real LLM, so they are free, fast and deterministic."""
    monkeypatch.setattr(ai, "client", None)

@pytest.fixture()
def client():
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    return TestClient(app)

def login(client, email="a@test.in"):
    r = client.post("/api/auth/signup", json={"email": email, "password": "secret12"})
    return {"Authorization": "Bearer " + r.json()["access_token"]}

def tx(**kw):
    return {"type": "expense", "amount": 100, "date": "2026-10-05", "category": "Food", "merchant": "Zomato", "note": "", "payment_method": "UPI", **kw}
