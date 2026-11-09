import { useState, useRef, useEffect } from "react";
import { api } from "../api.js";

export function Chat() {
  const [msgs, setMsgs] = useState([{ role: "ai", text: 'Ask me anything about your money, e.g. "How much did I spend on food last month?"' }]);
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false);
  const end = useRef();
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send(e) {
    e.preventDefault(); const question = q.trim(); if (question.length < 2) return;
    setMsgs((m) => [...m, { role: "me", text: question }]); setQ(""); setBusy(true);
    try { const r = await api("/api/ai/chat", { method: "POST", body: { question } }); setMsgs((m) => [...m, { role: "ai", text: typeof r?.answer === "string" ? r.answer : JSON.stringify(r?.answer ?? "No answer received.") }]); }
    catch (x) { setMsgs((m) => [...m, { role: "ai", text: `⚠️ ${String(x?.message || "Something went wrong")}`, error: true }]); }
    setBusy(false);
  }
  return (
    <div className="card flex h-[70vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto" aria-live="polite">
        {msgs.map((m, i) => <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === "me" ? "ml-auto bg-indigo-600 text-white" : m.error ? "bg-red-100 text-red-800" : "bg-slate-100 dark:bg-slate-800"}`}>{String(m.text)}</div>)}
        {busy && <div className="skeleton h-8 w-40" aria-label="Thinking" />}
        <div ref={end} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{["How much did I spend on food last month?", "What are my top 3 expense categories?", "How much did I spend on Swiggy?"].map((s) => <button key={s} type="button" className="chip" onClick={() => setQ(s)}>{s}</button>)}</div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input aria-label="Your question" className="input" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder="Ask your money…" />
        <button className="btn" disabled={busy}>Send</button>
      </form>
    </div>
  );
}
