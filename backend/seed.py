"""Creates demo user demo@lekka.in / demo1234 with ~3 months of Indian transactions."""
import random
from datetime import date, timedelta
from sqlalchemy import select
from app.database import Base, engine, SessionLocal
from app.models import User, Transaction, Budget
from app.auth import hash_pw

random.seed(7)
Base.metadata.create_all(engine)
db = SessionLocal()
if db.scalar(select(User).where(User.email == "demo@lekka.in")):
    print("Demo user already exists."); raise SystemExit
u = User(email="demo@lekka.in", password_hash=hash_pw("demo1234")); db.add(u); db.commit()

SPEND = [("Zomato", "Food", 150, 650, "UPI"), ("Swiggy", "Food", 120, 700, "UPI"), ("BigBasket", "Food", 400, 1800, "Card"),
         ("Uber", "Transport", 90, 450, "UPI"), ("Rapido", "Transport", 50, 200, "UPI"), ("Amazon", "Shopping", 300, 3500, "Card"),
         ("Myntra", "Shopping", 600, 2500, "Card"), ("Apollo Pharmacy", "Health", 150, 900, "Cash"), ("Netflix", "Entertainment", 199, 649, "Card"),
         ("BookMyShow", "Entertainment", 300, 900, "UPI"), ("Udemy", "Education", 449, 999, "Card"), ("Airtel", "Bills", 299, 999, "UPI")]
today = date.today()
for m in range(2, -1, -1):
    y, mo = today.year, today.month - m
    while mo <= 0: mo += 12; y -= 1
    first = date(y, mo, 1)
    last = min(today, (date(y + (mo == 12), mo % 12 + 1, 1) - timedelta(days=1)))
    def add(d, t, amt, cat, mer, pm, note=""):
        db.add(Transaction(user_id=u.id, type=t, amount=round(amt, 2), date=d, category=cat, merchant=mer, payment_method=pm, note=note))
    add(first, "income", 62000, "Other", "Employer Pvt Ltd", "NetBanking", "Salary")
    if first.replace(day=5) <= last: add(first.replace(day=5), "expense", 18000, "Rent", "Landlord", "NetBanking", "Monthly rent")
    if first.replace(day=8) <= last: add(first.replace(day=8), "expense", 1450, "Bills", "BESCOM", "UPI", "Electricity")
    for _ in range(random.randint(22, 30)):
        mer, cat, lo, hi, pm = random.choice(SPEND)
        add(first + timedelta(days=random.randint(0, (last - first).days)), "expense", random.uniform(lo, hi), cat, mer, pm)
    if m == 1: add(first.replace(day=20), "expense", 14999, "Shopping", "Croma", "Card", "Headphones")
cm = f"{today.year}-{today.month:02d}"
for cat, lim in [("Food", 8000), ("Transport", 2500), ("Shopping", 6000), ("Entertainment", 1500)]:
    db.add(Budget(user_id=u.id, category=cat, month=cm, limit=lim))
db.commit(); print("Seeded. Login: demo@lekka.in / demo1234")
