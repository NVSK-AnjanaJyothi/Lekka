"""All numbers shown to users or to the AI come from these SQL queries."""
from datetime import date
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from .models import Transaction as T

def month_range(month: str):
    y, m = int(month[:4]), int(month[5:7])
    start = date(y, m, 1)
    end = date(y + (m == 12), (m % 12) + 1, 1)
    return start, end

def spending_by_category(db: Session, uid: int, start: date, end: date):
    q = select(T.category, func.sum(T.amount)).where(
        T.user_id == uid, T.type == "expense", T.date >= start, T.date < end
    ).group_by(T.category).order_by(func.sum(T.amount).desc())
    return [{"category": c, "total": round(t, 2)} for c, t in db.execute(q)]

def totals(db: Session, uid: int, start: date, end: date):
    q = select(T.type, func.sum(T.amount)).where(T.user_id == uid, T.date >= start, T.date < end).group_by(T.type)
    d = {k: round(v, 2) for k, v in db.execute(q)}
    inc, exp = d.get("income", 0.0), d.get("expense", 0.0)
    return {"income": inc, "expense": exp, "savings": round(inc - exp, 2),
            "savings_rate": round((inc - exp) / inc * 100, 1) if inc else 0.0}

def monthly_totals(db: Session, uid: int, months: int = 6):
    today = date.today()
    out = []
    for i in range(months - 1, -1, -1):
        y, m = today.year, today.month - i
        while m <= 0:
            m += 12; y -= 1
        s, e = month_range(f"{y}-{m:02d}")
        out.append({"month": f"{y}-{m:02d}", **totals(db, uid, s, e)})
    return out

def top_merchants(db: Session, uid: int, start: date, end: date, n: int = 5):
    q = select(T.merchant, func.sum(T.amount)).where(
        T.user_id == uid, T.type == "expense", T.merchant != "", T.date >= start, T.date < end
    ).group_by(T.merchant).order_by(func.sum(T.amount).desc()).limit(n)
    return [{"merchant": m, "total": round(t, 2)} for m, t in db.execute(q)]

def search_transactions(db: Session, uid: int, text: str = "", category: str = "", start=None, end=None, limit: int = 20):
    q = select(T).where(T.user_id == uid)
    if text:
        like = f"%{text}%"
        q = q.where((T.merchant.ilike(like)) | (T.note.ilike(like)))
    if category:
        q = q.where(T.category == category)
    if start:
        q = q.where(T.date >= start)
    if end:
        q = q.where(T.date <= end)
    rows = db.scalars(q.order_by(T.date.desc()).limit(min(limit, 50))).all()
    return [{"date": r.date.isoformat(), "amount": r.amount, "type": r.type, "category": r.category, "merchant": r.merchant} for r in rows]

def unusual(db: Session, uid: int, start: date, end: date):
    avg = db.scalar(select(func.avg(T.amount)).where(T.user_id == uid, T.type == "expense"))
    if not avg:
        return []
    q = select(T).where(T.user_id == uid, T.type == "expense", T.date >= start, T.date < end, T.amount > avg * 3).order_by(T.amount.desc()).limit(3)
    return [{"date": r.date.isoformat(), "amount": r.amount, "merchant": r.merchant, "category": r.category} for r in db.scalars(q)]
