"""All numbers shown to users or to the AI come from these SQL queries."""
import math
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

# ---- festival months: compare spending in festival months with normal months
def monthly_category_spend(db: Session, uid: int):
    """{ 'YYYY-MM': {category: total expense} } for every month that has expenses."""
    q = select(T.date, T.category, func.sum(T.amount)).where(
        T.user_id == uid, T.type == "expense"
    ).group_by(T.date, T.category)
    out: dict[str, dict[str, float]] = {}
    for d, c, t in db.execute(q):
        m = f"{d.year}-{d.month:02d}"
        out.setdefault(m, {})
        out[m][c] = out[m].get(c, 0.0) + float(t)
    return out

def festival_compare(db: Session, uid: int, festivals, include_current: bool = False):
    """festivals: FestivalMonth rows. Only finished months are compared unless include_current is set."""
    today_m = date.today().strftime("%Y-%m")
    spend = monthly_category_spend(db, uid)
    fest_by_month = {f.month: f for f in festivals}

    def counted(m):
        return m < today_m or (include_current and m == today_m)

    fest = {m: v for m, v in spend.items() if m in fest_by_month and counted(m)}
    normal = {m: v for m, v in spend.items() if m not in fest_by_month and counted(m)}

    def avg_total(group):
        return round(sum(sum(v.values()) for v in group.values()) / len(group), 2) if group else None

    def avg_cat(group, c):
        return round(sum(v.get(c, 0.0) for v in group.values()) / len(group), 2) if group else None

    def change(f, n):
        if f is None or n is None:
            return None, None
        diff = round(f - n, 2)
        return diff, (round(diff / n * 100, 1) if n else None)

    avg_f, avg_n = avg_total(fest), avg_total(normal)
    diff, pct = change(avg_f, avg_n)

    by_cat = []
    for c in sorted({c for m in (*fest, *normal) for c in spend[m]}):
        f, n = avg_cat(fest, c), avg_cat(normal, c)
        d, p = change(f, n)
        by_cat.append({"category": c, "festival_avg": f, "normal_avg": n, "difference": d, "percent": p})
    by_cat.sort(key=lambda r: (r["difference"] is None, -(r["difference"] or 0), r["category"]))

    months = []
    for m in sorted(fest_by_month, reverse=True):
        row = fest_by_month[m]
        total = round(sum(spend[m].values()), 2) if m in spend else None
        if total is None:
            status = "upcoming" if m > today_m else "no_data"
        elif m in fest:
            status = "counted"
        else:
            status = "upcoming" if m > today_m else "in_progress"
        vs = round((total - avg_n) / avg_n * 100, 1) if status == "counted" and avg_n else None
        months.append({"id": row.id, "month": m, "label": row.label, "total": total, "status": status, "vs_normal_percent": vs})

    return {"include_current": include_current, "festival_count": len(fest), "normal_count": len(normal),
            "festival_avg": avg_f, "normal_avg": avg_n, "difference": diff, "percent": pct,
            "by_category": by_cat, "festival_months": months}

# ---- savings goals
def goal_view(g, today: date | None = None):
    today = today or date.today()
    remaining = max(g.target_amount - g.saved_amount, 0.0)
    days_left = (g.target_date - today).days
    months_left = max(1, math.ceil(days_left / 30.4375)) if days_left > 0 else 0
    if remaining <= 0:
        status, monthly = "done", 0
    else:
        status = "overdue" if days_left < 0 else "active"
        monthly = math.ceil(remaining / months_left) if months_left else math.ceil(remaining)
    return {"id": g.id, "name": g.name, "target_amount": g.target_amount, "saved_amount": g.saved_amount,
            "target_date": g.target_date.isoformat(), "remaining": round(remaining, 2),
            "percent": round(g.saved_amount / g.target_amount * 100, 1), "days_left": days_left,
            "months_left": months_left, "monthly_needed": monthly, "status": status}
