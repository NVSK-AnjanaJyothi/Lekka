# Spendwise — presentation notes (edit with your own experience)

## 1. One-line pitch
An expense tracker for Indian users where **the database does the maths and the AI explains it** — so the numbers are always exact.

## 2. Live demo script (5 minutes)
1. Log in as the demo user → dashboard: 4 stat cards, donut, trend, income vs expense, top merchants. Switch the month.
2. Transactions → type `paid 450 for Zomato yesterday via UPI` → show the **editable preview** → save. Point out that AI output is validated before it reaches the form.
3. Budgets → set Food low → show the 80% / 100% states.
4. Dashboard → **Generate insights** → note the figures match the cards (they come from SQL).
5. Ask your money → `How much did I spend on food last month?` → open Transactions, filter Food + last month, and show the total matches.
6. Stop the AI key (or go offline) → repeat step 2 → show the **graceful fallback**.

## 3. Design decisions worth explaining
- **No hallucinated numbers:** every figure is computed in SQL (`queries.py`); the LLM only phrases them, or calls tools that run the same queries.
- **Never trust AI output:** responses are parsed and validated with Pydantic; unknown categories are coerced; bad JSON falls back to rules (`tests/test_ai.py` proves this).
- **Per-user isolation:** every query filters by `user_id`; tests check one user cannot read or edit another's data.
- **Provider-agnostic AI:** an OpenAI-compatible client, switched with 3 env vars (Groq today, Gemini or others by config).
- **Database:** SQLite for zero-setup, PostgreSQL by changing `DATABASE_URL` (Docker Compose included).
- **Tests + CI:** 13 automated tests, run on every push.

## 4. How I used AI to build it (fill in honestly)
- **Tools:** Claude for architecture and code generation; Groq's free API for the in-app AI.
- **Prompting:** I gave a detailed spec (features, stack, API contract, rules like "no placeholders" and "validate AI output") and asked for files one at a time.
- **What I reviewed / changed / debugged** (examples from my own build; keep only what's true for you):
  - The free LLM model I first configured had been retired by the provider (404). I diagnosed it with a one-line test, found the replacement in the provider's docs, and updated the config.
  - A stale `.env` value was overriding the code default — I learned `.env` takes priority and restarted the server.
  - I fixed folder/virtualenv path problems when running the backend and frontend as two processes.
  - I added automated tests to prove validation, user isolation and the AI fallbacks.

## 5. Honest limitations (say these before they ask)
- Money is stored as floating-point; production should use integer paise or `Numeric`.
- Free AI tier has rate limits; the app degrades gracefully when they are hit.
- No email verification / password reset / refresh tokens yet.
- Tables are created with `create_all`; a production system would use Alembic migrations.

## 6. If asked "what next?"
Recurring transactions, bank-SMS import, Alembic migrations, refresh tokens, per-category AI-suggested budgets.
