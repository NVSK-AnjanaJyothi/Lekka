import csv, io, os
from datetime import date
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from . import ai, queries as Q
from .auth import current_user, hash_pw, check_pw, make_token
from .database import Base, engine, get_db
from .models import User, Category, Transaction as T, Budget, FestivalMonth, SavingsGoal, DEFAULT_CATEGORIES
from .schemas import Credentials, TxIn, TxOut, CategoryIn, BudgetIn, FestivalIn, GoalIn, ContributeIn, NLIn, ChatIn

Base.metadata.create_all(engine)
app = FastAPI(title="Spendwise API")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
                   allow_methods=["*"], allow_headers=["*"])

def cats(db, uid):
    return DEFAULT_CATEGORIES + [c.name for c in db.scalars(select(Category).where(Category.user_id == uid))]

def check_cat(db, uid, name):
    if name not in cats(db, uid):
        raise HTTPException(422, f"Unknown category '{name}'")

def ai_error(e):
    raise HTTPException(503, "The AI assistant is unavailable right now. Please try again shortly.")

@app.get("/api/health")
def health():
    return {"ok": True}

# ---- auth
@app.post("/api/auth/signup", status_code=201)
def signup(c: Credentials, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == c.email.lower())):
        raise HTTPException(409, "Email already registered")
    u = User(email=c.email.lower(), password_hash=hash_pw(c.password))
    db.add(u); db.commit()
    return {"access_token": make_token(u.id)}

@app.post("/api/auth/login")
def login(c: Credentials, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.email == c.email.lower()))
    if not u or not check_pw(c.password, u.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return {"access_token": make_token(u.id)}

@app.get("/api/me")
def me(u: User = Depends(current_user)):
    return {"id": u.id, "email": u.email}

# ---- categories
@app.get("/api/categories")
def list_cats(u: User = Depends(current_user), db: Session = Depends(get_db)):
    return cats(db, u.id)

@app.post("/api/categories", status_code=201)
def add_cat(c: CategoryIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    name = c.name.strip()
    if name in cats(db, u.id):
        raise HTTPException(409, "Category already exists")
    db.add(Category(user_id=u.id, name=name)); db.commit()
    return cats(db, u.id)

# ---- transactions
@app.get("/api/transactions")
def list_tx(q: str = "", type: str = "", category: str = "", start: date | None = None, end: date | None = None,
            page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
            u: User = Depends(current_user), db: Session = Depends(get_db)):
    f = [T.user_id == u.id]
    if q: f.append(T.merchant.ilike(f"%{q}%") | T.note.ilike(f"%{q}%"))
    if type in ("income", "expense"): f.append(T.type == type)
    if category: f.append(T.category == category)
    if start: f.append(T.date >= start)
    if end: f.append(T.date <= end)
    total = db.scalar(select(func.count()).select_from(T).where(*f))
    rows = db.scalars(select(T).where(*f).order_by(T.date.desc(), T.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [TxOut.model_validate(r) for r in rows], "total": total, "page": page, "page_size": page_size}

@app.post("/api/transactions", response_model=TxOut, status_code=201)
def add_tx(t: TxIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    check_cat(db, u.id, t.category)
    row = T(user_id=u.id, **t.model_dump()); db.add(row); db.commit(); db.refresh(row)
    return row

def own_tx(db, uid, tid):
    row = db.get(T, tid)
    if not row or row.user_id != uid:
        raise HTTPException(404, "Transaction not found")
    return row

@app.put("/api/transactions/{tid}", response_model=TxOut)
def edit_tx(tid: int, t: TxIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    row = own_tx(db, u.id, tid); check_cat(db, u.id, t.category)
    for k, v in t.model_dump().items(): setattr(row, k, v)
    db.commit(); db.refresh(row)
    return row

@app.delete("/api/transactions/{tid}", status_code=204)
def del_tx(tid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(own_tx(db, u.id, tid)); db.commit()

# ---- budgets
@app.get("/api/budgets")
def list_budgets(month: str = Query(pattern=r"^\d{4}-\d{2}$"), u: User = Depends(current_user), db: Session = Depends(get_db)):
    s, e = Q.month_range(month)
    spent = {r["category"]: r["total"] for r in Q.spending_by_category(db, u.id, s, e)}
    out = []
    for b in db.scalars(select(Budget).where(Budget.user_id == u.id, Budget.month == month)):
        pct = round(spent.get(b.category, 0) / b.limit * 100, 1)
        out.append({"id": b.id, "category": b.category, "limit": b.limit, "spent": spent.get(b.category, 0), "percent": pct,
                    "status": "over" if pct >= 100 else "warning" if pct >= 80 else "ok"})
    return out

@app.put("/api/budgets")
def set_budget(b: BudgetIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    check_cat(db, u.id, b.category)
    row = db.scalar(select(Budget).where(Budget.user_id == u.id, Budget.category == b.category, Budget.month == b.month))
    if row: row.limit = b.limit
    else: db.add(Budget(user_id=u.id, **b.model_dump()))
    db.commit()
    return {"ok": True}

@app.delete("/api/budgets/{bid}", status_code=204)
def del_budget(bid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(Budget, bid)
    if not row or row.user_id != u.id: raise HTTPException(404, "Budget not found")
    db.delete(row); db.commit()

# ---- festival months
@app.put("/api/festival-months")
def set_festival_month(b: FestivalIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(FestivalMonth).where(FestivalMonth.user_id == u.id, FestivalMonth.month == b.month))
    if row: row.label = b.label
    else:
        row = FestivalMonth(user_id=u.id, month=b.month, label=b.label); db.add(row)
    db.commit(); db.refresh(row)
    return {"id": row.id, "month": row.month, "label": row.label}

@app.delete("/api/festival-months/{fid}", status_code=204)
def del_festival_month(fid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(FestivalMonth, fid)
    if not row or row.user_id != u.id: raise HTTPException(404, "Festival month not found")
    db.delete(row); db.commit()

@app.get("/api/festival/compare")
def festival_compare(include_current: bool = False, u: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(FestivalMonth).where(FestivalMonth.user_id == u.id)).all()
    return Q.festival_compare(db, u.id, rows, include_current)

# ---- savings goals
def own_goal(db, uid, gid):
    row = db.get(SavingsGoal, gid)
    if not row or row.user_id != uid:
        raise HTTPException(404, "Goal not found")
    return row

@app.get("/api/goals")
def list_goals(u: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(SavingsGoal).where(SavingsGoal.user_id == u.id)).all()
    out = [Q.goal_view(g) for g in rows]
    out.sort(key=lambda g: (g["status"] == "done", g["target_date"], g["id"]))
    return out

@app.post("/api/goals", status_code=201)
def add_goal(g: GoalIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    if g.target_date < date.today():
        raise HTTPException(422, "Target date must be today or later")
    row = SavingsGoal(user_id=u.id, **g.model_dump()); db.add(row); db.commit(); db.refresh(row)
    return Q.goal_view(row)

@app.put("/api/goals/{gid}")
def edit_goal(gid: int, g: GoalIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    row = own_goal(db, u.id, gid)
    for k, v in g.model_dump().items(): setattr(row, k, v)
    db.commit(); db.refresh(row)
    return Q.goal_view(row)

@app.post("/api/goals/{gid}/contribute")
def contribute_goal(gid: int, b: ContributeIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    row = own_goal(db, u.id, gid)
    new = round(row.saved_amount + b.amount, 2)
    if new >= 1e9: raise HTTPException(422, "Saved amount is too large")
    row.saved_amount = new
    db.commit(); db.refresh(row)
    return Q.goal_view(row)

@app.delete("/api/goals/{gid}", status_code=204)
def del_goal(gid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(own_goal(db, u.id, gid)); db.commit()

# ---- dashboard
@app.get("/api/dashboard")
def dashboard(month: str = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$"), u: User = Depends(current_user), db: Session = Depends(get_db)):
    s, e = Q.month_range(month)
    return {"month": month, "totals": Q.totals(db, u.id, s, e), "by_category": Q.spending_by_category(db, u.id, s, e),
            "monthly": Q.monthly_totals(db, u.id, 6), "top_merchants": Q.top_merchants(db, u.id, s, e)}

# ---- CSV
FIELDS = ["date", "type", "amount", "category", "merchant", "note", "payment_method"]

@app.get("/api/export/csv")
def export_csv(u: User = Depends(current_user), db: Session = Depends(get_db)):
    buf = io.StringIO(); w = csv.writer(buf); w.writerow(FIELDS)
    for r in db.scalars(select(T).where(T.user_id == u.id).order_by(T.date)):
        w.writerow([r.date, r.type, r.amount, r.category, r.merchant, r.note, r.payment_method])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=spendwise.csv"})

@app.post("/api/import/csv")
async def import_csv(file: UploadFile = File(...), u: User = Depends(current_user), db: Session = Depends(get_db)):
    raw = (await file.read(2_000_000)).decode("utf-8-sig", errors="replace")
    allowed = cats(db, u.id); ok, errors = 0, []
    for i, row in enumerate(csv.DictReader(io.StringIO(raw)), start=2):
        try:
            row = {k.strip().lower(): (v or "").strip() for k, v in row.items() if k}
            if not row.get("category") or row["category"] not in allowed:
                row["category"] = ai.rule_category(f'{row.get("merchant", "")} {row.get("note", "")}')
            row.setdefault("type", "expense"); row["type"] = row["type"] or "expense"
            if row.get("payment_method") not in ("UPI", "Card", "Cash", "NetBanking", "Other"): row["payment_method"] = "Other"
            t = TxIn(**{k: v for k, v in row.items() if k in FIELDS})
            db.add(T(user_id=u.id, **t.model_dump())); ok += 1
        except (ValidationError, ValueError) as e:
            errors.append(f"Row {i}: {str(e).splitlines()[0]}")
    db.commit()
    return {"imported": ok, "errors": errors[:20]}

# ---- AI
@app.post("/api/ai/parse")
def ai_parse(b: NLIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        return ai.parse_entry(b.text, cats(db, u.id))
    except ValueError as e:
        raise HTTPException(422, str(e))

@app.post("/api/ai/categorize")
def ai_categorize(u: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(T).where(T.user_id == u.id, T.category == "Other").limit(50)).all()
    if not rows: return {"updated": 0, "source": "none"}
    res = ai.categorize_batch([{"id": r.id, "merchant": r.merchant, "note": r.note} for r in rows], cats(db, u.id))
    n = 0
    for r in rows:
        if res.get(r.id) and res[r.id] != r.category: r.category = res[r.id]; n += 1
    db.commit()
    return {"updated": n, "source": "ai" if ai.client else "rules"}

@app.get("/api/ai/insights")
def ai_insights(month: str = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$"), u: User = Depends(current_user), db: Session = Depends(get_db)):
    return ai.insights(db, u.id, month)

@app.post("/api/ai/chat")
def ai_chat(b: ChatIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        return {"answer": ai.chat(db, u.id, b.question)}
    except ai.AIUnavailable as e:
        ai_error(e)
