import json, os, re
from datetime import date, timedelta
from openai import OpenAI
from pydantic import ValidationError
from sqlalchemy.orm import Session
from . import queries as Q
from .models import DEFAULT_CATEGORIES
from .schemas import ParsedEntry

MODEL = os.getenv("AI_MODEL", "openai/gpt-oss-120b")
BASE_URL = os.getenv("AI_BASE_URL", "https://api.groq.com/openai/v1")
client = OpenAI(api_key=os.getenv("AI_API_KEY"), base_url=BASE_URL, timeout=30) if os.getenv("AI_API_KEY") else None

# gpt-oss models "think" first; keep that short so answers are not cut off
EXTRA = {"extra_body": {"reasoning_effort": "low"}} if "gpt-oss" in MODEL else {}

class AIUnavailable(Exception):
    pass

KEYWORDS = {
    "Food": ["zomato", "swiggy", "restaurant", "cafe", "bigbasket", "blinkit", "zepto", "grocer", "dominos", "mcdonald"],
    "Transport": ["uber", "ola", "rapido", "metro", "petrol", "fuel", "irctc", "redbus"],
    "Rent": ["rent", "landlord"],
    "Shopping": ["amazon", "flipkart", "myntra", "ajio", "nykaa"],
    "Bills": ["electricity", "airtel", "jio", "wifi", "broadband", "recharge", "gas"],
    "Health": ["pharmacy", "apollo", "medplus", "hospital", "clinic", "gym"],
    "Entertainment": ["netflix", "spotify", "bookmyshow", "hotstar", "prime"],
    "Education": ["udemy", "coursera", "course", "books", "tuition"],
}

def rule_category(text: str) -> str:
    t = text.lower()
    for cat, words in KEYWORDS.items():
        if any(w in t for w in words):
            return cat
    return "Other"

def _json(text: str):
    m = re.search(r"[\[{].*[\]}]", text, re.S)
    if not m:
        raise ValueError("no JSON")
    return json.loads(m.group(0))

def _ask(system: str, prompt: str, max_tokens=800) -> str:
    if not client:
        raise AIUnavailable("AI key not configured")
    try:
        r = client.chat.completions.create(model=MODEL, max_tokens=max(max_tokens, 1500), temperature=0.2, **EXTRA,
                                           messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}])
        return r.choices[0].message.content or ""
    except Exception as e:
        raise AIUnavailable(str(e))

def parse_entry(text: str, categories: list[str]) -> dict:
    today = date.today()
    system = (f"You extract one transaction from Indian English text. Today is {today.isoformat()}. "
              f"Allowed categories: {categories}. Payment methods: UPI, Card, Cash, NetBanking, Other. "
              "Reply with ONLY a JSON object: amount (number, INR), date (YYYY-MM-DD), category, merchant, "
              "payment_method, type (income|expense). Resolve words like 'yesterday' from today's date.")
    try:
        data = _json(_ask(system, text, 300))
        entry = ParsedEntry(**data)
        if entry.category not in categories:
            entry.category = rule_category(entry.merchant + " " + text)
        return {**entry.model_dump(mode="json"), "source": "ai"}
    except (AIUnavailable, ValueError, ValidationError):
        return _rule_parse(text, categories)

def _rule_parse(text: str, categories: list[str]) -> dict:
    m = re.search(r"(\d[\d,]*\.?\d*)", text)
    if not m:
        raise ValueError("Could not find an amount. Try: 'paid 450 for Zomato yesterday via UPI'")
    d = date.today() - timedelta(days=1 if "yesterday" in text.lower() else 0)
    pm = next((p for p in ["UPI", "Card", "Cash", "NetBanking"] if p.lower() in text.lower()), "Other")
    mm = re.search(r"(?:for|at|to)\s+([A-Za-z][\w &]*?)(?:\s+(?:yesterday|today|via|using|on)\b|$)", text)
    merchant = mm.group(1).strip() if mm else ""
    cat = rule_category(text)
    return {"amount": float(m.group(1).replace(",", "")), "date": d.isoformat(), "category": cat if cat in categories else "Other",
            "merchant": merchant, "payment_method": pm, "type": "income" if re.search(r"salary|received|credited", text, re.I) else "expense",
            "source": "rules"}

def categorize_batch(items: list[dict], categories: list[str]) -> dict[int, str]:
    """items: [{id, merchant, note}] -> {id: category}. Falls back to keyword rules per item."""
    result = {i["id"]: rule_category(f'{i["merchant"]} {i["note"]}') for i in items}
    try:
        raw = _json(_ask(f"Categorize each transaction into exactly one of {categories}. "
                         'Reply ONLY with JSON: {"<id>": "<category>", ...}', json.dumps(items), 1500))
        for k, v in raw.items():
            if str(k).isdigit() and int(k) in result and v in categories:
                result[int(k)] = v
    except (AIUnavailable, ValueError, AttributeError):
        pass
    return result

def insights(db: Session, uid: int, month: str) -> dict:
    s, e = Q.month_range(month)
    py, pm = (int(month[:4]) - (month[5:] == "01"), 12 if month[5:] == "01" else int(month[5:]) - 1)
    ps, pe = Q.month_range(f"{py}-{pm:02d}")
    facts = {"month": month, "totals": Q.totals(db, uid, s, e), "previous_month_totals": Q.totals(db, uid, ps, pe),
             "by_category": Q.spending_by_category(db, uid, s, e), "previous_by_category": Q.spending_by_category(db, uid, ps, pe),
             "top_merchants": Q.top_merchants(db, uid, s, e), "unusual_transactions": Q.unusual(db, uid, s, e)}
    try:
        text = _ask("You are a friendly Indian personal-finance coach. Use ONLY the numbers in the JSON facts; never invent figures. "
                    "Currency is INR (₹). Write: 1) top spending patterns, 2) month-over-month changes, 3) unusual transactions, "
                    "4) exactly 3 concrete saving suggestions. Be concise, use short bullets.", json.dumps(facts), 900)
        return {"facts": facts, "summary": text, "source": "ai"}
    except AIUnavailable:
        top = facts["by_category"][:3]
        txt = "AI insights are unavailable right now. Top categories: " + (", ".join(f"{c['category']} ₹{c['total']:,.0f}" for c in top) or "no spending yet") + "."
        return {"facts": facts, "summary": txt, "source": "fallback"}

TOOLS = [
    {"name": "get_spending_by_category", "description": "Total expenses per category between two dates (inclusive start, exclusive end).",
     "input_schema": {"type": "object", "properties": {"start": {"type": "string", "description": "YYYY-MM-DD"}, "end": {"type": "string", "description": "YYYY-MM-DD, exclusive"}}, "required": ["start", "end"]}},
    {"name": "get_monthly_totals", "description": "Income, expense, savings for the last N months.",
     "input_schema": {"type": "object", "properties": {"months": {"type": "integer", "minimum": 1, "maximum": 12}}, "required": ["months"]}},
    {"name": "search_transactions", "description": "Find transactions by text, category and date range.",
     "input_schema": {"type": "object", "properties": {"text": {"type": "string"}, "category": {"type": "string"}, "start": {"type": "string"}, "end": {"type": "string"}, "limit": {"type": "integer"}}}},
]

def _d(v):
    return date.fromisoformat(v) if v else None

def run_tool(db, uid, name, a):
    try:
        if name == "get_spending_by_category":
            return Q.spending_by_category(db, uid, _d(a["start"]), _d(a["end"]))
        if name == "get_monthly_totals":
            return Q.monthly_totals(db, uid, max(1, min(int(a.get("months", 3)), 12)))
        if name == "search_transactions":
            return Q.search_transactions(db, uid, str(a.get("text", ""))[:100], str(a.get("category", ""))[:50], _d(a.get("start")), _d(a.get("end")), int(a.get("limit", 20)))
    except (KeyError, ValueError, TypeError) as e:
        return {"error": f"bad arguments: {e}"}
    return {"error": "unknown tool"}

def chat(db: Session, uid: int, question: str) -> str:
    if not client:
        raise AIUnavailable("AI key not configured")
    system = (f"You answer questions about the user's own finances in INR (₹). Today is {date.today().isoformat()}. "
              "ALWAYS call tools to get numbers; never guess. Quote exact figures from tool results. 'Last month' means the previous calendar month.")
    tools = [{"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["input_schema"]}} for t in TOOLS]
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": question}]
    try:
        for _ in range(5):
            r = client.chat.completions.create(model=MODEL, max_tokens=2000, temperature=0.2, tools=tools, **EXTRA, messages=msgs)
            m = r.choices[0].message
            if not m.tool_calls:
                return m.content or "I couldn't find an answer."
            msgs.append({"role": "assistant", "content": m.content or "", "tool_calls": [
                {"id": c.id, "type": "function", "function": {"name": c.function.name, "arguments": c.function.arguments}} for c in m.tool_calls]})
            for c in m.tool_calls:
                try:
                    args = json.loads(c.function.arguments or "{}")
                except ValueError:
                    args = {}
                msgs.append({"role": "tool", "tool_call_id": c.id, "content": json.dumps(run_tool(db, uid, c.function.name, args))})
        return "That question needed too many steps. Try asking it more simply."
    except Exception as e:
        raise AIUnavailable(str(e))
