from tests.conftest import login, tx

def test_auth_flow(client):
    login(client)
    assert client.post("/api/auth/signup", json={"email": "a@test.in", "password": "secret12"}).status_code == 409
    assert client.post("/api/auth/login", json={"email": "a@test.in", "password": "wrongpass"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "a@test.in", "password": "secret12"}).status_code == 200
    assert client.get("/api/transactions").status_code == 401

def test_transaction_validation(client):
    h = login(client)
    assert client.post("/api/transactions", json=tx(amount=0), headers=h).status_code == 422
    assert client.post("/api/transactions", json=tx(amount=-5), headers=h).status_code == 422
    assert client.post("/api/transactions", json=tx(category="Nope"), headers=h).status_code == 422
    assert client.post("/api/transactions", json=tx(date="not-a-date"), headers=h).status_code == 422

def test_crud_filter_pagination(client):
    h = login(client)
    for i in range(12):
        client.post("/api/transactions", json=tx(amount=10 + i, merchant="Uber" if i % 2 else "Zomato", category="Transport" if i % 2 else "Food"), headers=h)
    r = client.get("/api/transactions?page_size=5&page=3", headers=h).json()
    assert r["total"] == 12 and len(r["items"]) == 2
    assert client.get("/api/transactions?category=Transport", headers=h).json()["total"] == 6
    assert client.get("/api/transactions?q=zomato", headers=h).json()["total"] == 6
    tid = r["items"][0]["id"]
    assert client.put(f"/api/transactions/{tid}", json=tx(amount=999), headers=h).json()["amount"] == 999
    assert client.delete(f"/api/transactions/{tid}", headers=h).status_code == 204
    assert client.get("/api/transactions", headers=h).json()["total"] == 11

def test_users_cannot_see_each_others_data(client):
    a, b = login(client, "a@test.in"), login(client, "b@test.in")
    tid = client.post("/api/transactions", json=tx(), headers=a).json()["id"]
    assert client.get("/api/transactions", headers=b).json()["total"] == 0
    assert client.put(f"/api/transactions/{tid}", json=tx(), headers=b).status_code == 404
    assert client.delete(f"/api/transactions/{tid}", headers=b).status_code == 404

def test_custom_category_and_budget_status(client):
    h = login(client)
    client.post("/api/categories", json={"name": "Pets"}, headers=h)
    assert client.post("/api/categories", json={"name": "Pets"}, headers=h).status_code == 409
    client.put("/api/budgets", json={"category": "Food", "month": "2026-10", "limit": 1000}, headers=h)
    client.post("/api/transactions", json=tx(amount=850), headers=h)
    assert client.get("/api/budgets?month=2026-10", headers=h).json()[0]["status"] == "warning"
    client.post("/api/transactions", json=tx(amount=200), headers=h)
    assert client.get("/api/budgets?month=2026-10", headers=h).json()[0]["status"] == "over"

def test_dashboard_numbers_come_from_sql(client):
    h = login(client)
    client.post("/api/transactions", json=tx(type="income", amount=50000, category="Other", merchant="Employer"), headers=h)
    client.post("/api/transactions", json=tx(amount=10000, category="Rent"), headers=h)
    d = client.get("/api/dashboard?month=2026-10", headers=h).json()
    assert d["totals"] == {"income": 50000, "expense": 10000, "savings": 40000, "savings_rate": 80.0}
    assert d["by_category"] == [{"category": "Rent", "total": 10000}]

def test_csv_import_export(client):
    h = login(client)
    csv = "date,type,amount,category,merchant\n2026-10-01,expense,250,,Swiggy\n2026-10-02,expense,-9,Food,Bad\nnotadate,expense,5,Food,X\n"
    r = client.post("/api/import/csv", files={"file": ("t.csv", csv)}, headers=h).json()
    assert r["imported"] == 1 and len(r["errors"]) == 2
    items = client.get("/api/transactions", headers=h).json()["items"]
    assert items[0]["category"] == "Food"  # auto-categorised by rules
    assert "Swiggy" in client.get("/api/export/csv", headers=h).text
