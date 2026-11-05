import json
from app import ai
from app import queries as Q
from tests.conftest import login, tx

CATS = ai.DEFAULT_CATEGORIES if hasattr(ai, "DEFAULT_CATEGORIES") else []

def test_parse_falls_back_to_rules_when_ai_is_down(client):
    h = login(client)
    r = client.post("/api/ai/parse", json={"text": "paid 450 for Zomato yesterday via UPI"}, headers=h).json()
    assert r["source"] == "rules" and r["amount"] == 450 and r["category"] == "Food" and r["payment_method"] == "UPI"

def test_parse_rejects_text_without_amount(client):
    h = login(client)
    assert client.post("/api/ai/parse", json={"text": "bought some stuff"}, headers=h).status_code == 422

def test_ai_output_is_validated_before_use(monkeypatch):
    # valid JSON but a category we don't have -> coerced to a real one
    monkeypatch.setattr(ai, "_ask", lambda *a, **k: json.dumps({"amount": 99, "date": "2026-10-01", "category": "Made-Up", "merchant": "Uber", "payment_method": "UPI", "type": "expense"}))
    r = ai.parse_entry("uber 99", ["Food", "Transport", "Other"])
    assert r["category"] == "Transport" and r["source"] == "ai"
    # negative amount violates the schema -> falls back to rules, never trusted
    monkeypatch.setattr(ai, "_ask", lambda *a, **k: json.dumps({"amount": -5, "date": "2026-10-01", "category": "Food"}))
    assert ai.parse_entry("paid 50 for lunch", ["Food", "Other"])["source"] == "rules"
    # garbage text -> falls back too
    monkeypatch.setattr(ai, "_ask", lambda *a, **k: "sorry, I cannot help")
    assert ai.parse_entry("paid 50 for lunch", ["Food", "Other"])["amount"] == 50

def test_batch_categorize_ignores_invalid_ai_categories(monkeypatch):
    monkeypatch.setattr(ai, "_ask", lambda *a, **k: json.dumps({"1": "Health", "2": "Hacked"}))
    out = ai.categorize_batch([{"id": 1, "merchant": "Clinic X", "note": ""}, {"id": 2, "merchant": "Netflix", "note": ""}], ["Health", "Entertainment", "Other"])
    assert out == {1: "Health", 2: "Entertainment"}

def test_chat_tools_are_scoped_to_the_user_and_validate_args(client):
    a, b = login(client, "a@test.in"), login(client, "b@test.in")
    client.post("/api/transactions", json=tx(amount=300), headers=a)
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        assert ai.run_tool(db, 1, "get_spending_by_category", {"start": "2026-10-01", "end": "2026-11-01"}) == [{"category": "Food", "total": 300}]
        assert ai.run_tool(db, 2, "get_spending_by_category", {"start": "2026-10-01", "end": "2026-11-01"}) == []
        assert "error" in ai.run_tool(db, 1, "get_spending_by_category", {"start": "garbage"})
        assert "error" in ai.run_tool(db, 1, "drop_tables", {})
    finally:
        db.close()

def test_chat_and_insights_degrade_gracefully(client):
    h = login(client)
    assert client.post("/api/ai/chat", json={"question": "how much on food?"}, headers=h).status_code == 503
    r = client.get("/api/ai/insights?month=2026-10", headers=h).json()
    assert r["source"] == "fallback" and "unavailable" in r["summary"]
