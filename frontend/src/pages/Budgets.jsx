import { useEffect, useState } from "react";
import { api, inr, thisMonth } from "../api.js";
import { useToast, Skeleton, Empty, ErrorBox } from "../ui.jsx";

export function Budgets() {
  const toast = useToast();
  const [month, setMonth] = useState(thisMonth());
  const [list, setList] = useState(null);
  const [cats, setCats] = useState([]);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ category: "Food", limit: "" });

  const load = () => { setErr(""); api(`/api/budgets?month=${month}`).then(setList).catch((e) => setErr(e.message)); };
  useEffect(() => { load(); }, [month]);
  useEffect(() => { api("/api/categories").then(setCats).catch(() => {}); }, []);

  async function save(e) {
    e.preventDefault();
    if (!(Number(f.limit) > 0)) return toast("Enter a limit above 0", "err");
    try { await api("/api/budgets", { method: "PUT", body: { category: f.category, month, limit: Number(f.limit) } }); setF({ ...f, limit: "" }); toast("Budget saved"); load(); } catch (x) { toast(x.message, "err"); }
  }
  const color = { ok: "bg-emerald-500", warning: "bg-amber-500", over: "bg-red-500" };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-2xl font-bold tracking-tight">Monthly budgets</h2><p className="text-sm text-slate-500">Set limits and track your progress</p></div>
        <input aria-label="Month" type="month" className="input w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
      </div>
      <form onSubmit={save} className="card flex flex-wrap gap-2">
        <select aria-label="Category" className="input w-auto" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <input aria-label="Limit" placeholder="Limit ₹" inputMode="decimal" className="input w-40" value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} />
        <button className="btn">Set budget</button>
      </form>
      {err ? <ErrorBox msg={err} retry={load} /> : !list ? <Skeleton className="h-40" /> : list.length === 0 ? <div className="card"><Empty>No budgets for this month yet.</Empty></div> : list.map((b) => (
        <div key={b.id} className="card">
          <div className="flex justify-between text-sm"><span className="font-medium">{b.category}</span><span>{inr(b.spent)} / {inr(b.limit)} ({b.percent}%)</span></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={Math.min(b.percent, 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${b.category} budget used`}>
            <div className={`h-full ${color[b.status]}`} style={{ width: `${Math.min(b.percent, 100)}%` }} /></div>
          {b.status === "warning" && <p className="mt-2 text-xs text-amber-600">⚠️ You've used over 80% of this budget.</p>}
          {b.status === "over" && <p className="mt-2 text-xs text-red-600">🚨 Budget exceeded by {inr(b.spent - b.limit)}.</p>}
        </div>))}
    </div>
  );
}
