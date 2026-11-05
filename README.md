# Spendwise — AI Expense Tracker (₹)

FastAPI + SQLAlchemy + SQLite backend, React + Vite + Tailwind + Recharts frontend, an OpenAI-compatible LLM API (free Groq tier by default, tool calling) backend-only.

## Run locally
```bash
# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add AI_API_KEY (free from console.groq.com) and a long SECRET_KEY
python seed.py              # demo@spendwise.in / demo1234, 3 months of data
uvicorn app.main:app --reload   # http://localhost:8000/docs

# frontend (new terminal)
cd frontend && cp .env.example .env && npm install && npm run dev   # http://localhost:5173
```

## Database
SQLite by default (zero setup). For **PostgreSQL**, set `DATABASE_URL=postgresql://user:pass@host:5432/db` (works with Neon, Supabase, Render Postgres) or run everything with Docker:
```bash
docker compose up --build            # Postgres + API on :8000
docker compose exec api python seed.py
```

## Tests
```bash
cd backend && pip install -r requirements-dev.txt && python -m pytest -q   # 13 tests, no real AI calls
```
Covers auth, validation, CRUD/filters/pagination, per-user isolation, budgets, dashboard maths, CSV, and every AI fallback/validation path. CI runs them on each push (`.github/workflows/ci.yml`).

## API contract (all /api, JSON, Bearer JWT except auth)
| Method | Path | Body / Query | Response |
|---|---|---|---|
| POST | /auth/signup, /auth/login | {email, password(min 6)} | {access_token} · 409 exists · 401 bad creds · 422 |
| GET | /me | – | {id, email} |
| GET/POST | /categories | {name} | string[] · 409 duplicate |
| GET | /transactions | q,type,category,start,end,page,page_size | {items,total,page,page_size} |
| POST/PUT/DELETE | /transactions[/id] | {type,amount>0,date,category,merchant,note,payment_method} | TxOut / 204 · 404 · 422 |
| GET/PUT | /budgets | ?month=YYYY-MM · {category,month,limit} | [{category,limit,spent,percent,status}] |
| DELETE | /budgets/{id} | – | 204 |
| GET | /dashboard?month= | – | {totals,by_category,monthly,top_merchants} |
| GET/POST | /export/csv, /import/csv | multipart file | CSV / {imported,errors[]} |
| POST | /ai/parse | {text} | {amount,date,category,merchant,payment_method,type,source} |
| POST | /ai/categorize | – | {updated} |
| GET | /ai/insights?month= | – | {facts,summary,source} |
| POST | /ai/chat | {question} | {answer} · 503 if AI down |

## ER diagram
```
users 1──* transactions (user_id, type, amount, date, category, merchant, note, payment_method)
users 1──* categories   (user_id, name)  -- custom only; defaults are built in
users 1──* budgets      (user_id, category, month YYYY-MM, limit)  UNIQUE(user, category, month)
```

## How AI is used
- **Natural-language entry**: the model returns JSON → validated by `ParsedEntry` (Pydantic) → category must be in the user's list → shown as an editable preview. Regex fallback if the call or validation fails.
- **Batch categorization**: transactions in "Other" are sent to the model; only categories from the allowed list are accepted, otherwise keyword rules are used.
- **Insights**: all figures are computed in SQL (`queries.py`); the model only explains the JSON facts.
- **Ask your money**: the model calls `get_spending_by_category`, `get_monthly_totals`, `search_transactions`, executed against the DB scoped to the logged-in user, with validated arguments.

## Deploy
**Backend (Render)**: New Web Service → root `backend`, build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Env: SECRET_KEY, AI_API_KEY, AI_BASE_URL, AI_MODEL, CORS_ORIGINS=<your Vercel URL>. For persistence use Render Postgres: set DATABASE_URL (add `psycopg2-binary` to requirements); SQLite on Render's free disk resets on redeploy.
**Frontend (Vercel)**: import repo, root `frontend`, framework Vite, env `VITE_API_URL=<Render URL>`.

## Common errors
- `CORS error` → CORS_ORIGINS must exactly match the frontend origin (no trailing slash).
- `503 AI unavailable` → missing or invalid AI_API_KEY, wrong AI_MODEL, or free-tier rate limit hit; app falls back to rules.
- `401` after restart → SECRET_KEY changed; log in again.
- `bcrypt` build errors → upgrade pip, use Python 3.10+.
- Blank dashboard → run `python seed.py` or add transactions in the selected month.

## Screenshots
Add images under `docs/` and link them here.
