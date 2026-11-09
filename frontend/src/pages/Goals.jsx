import { useEffect, useState } from "react";
import { api, inr } from "../api.js";
import { useToast, Skeleton, Empty, ErrorBox } from "../ui.jsx";

const num = (v) => Number(String(v).replace(/,/g, "").trim());
const fmtDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const todayStr = () => new Date().toISOString().slice(0, 10);
const EMPTY = { name: "", target: "", saved: "", date: "" };
const BAR = { active: "bg-indigo-500", done: "bg-emerald-500", overdue: "bg-red-500" };

function AddMoney({ onAdd }) {
  const toast = useToast();
  const [v, setV] = useState("");
  async function submit(e) {
    e.preventDefault();
    const n = num(v);
    if (!(n > 0)) return toast("Enter an amount above 0", "err");
    if (await onAdd(n)) setV("");
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input aria-label="Amount to add" placeholder="Add ₹" inputMode="decimal" className="input !w-28" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn-ghost">Add savings</button>
    </form>
  );
}

export function Goals() {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [f, setF] = useState(EMPTY);
  const [editing, setEditing] = useState(null);

  const load = () => { setErr(""); api("/api/goals").then(setList).catch((e) => setErr(e.message)); };
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    const name = f.name.trim(), target = num(f.target), saved = f.saved.trim() === "" ? 0 : num(f.saved);
    if (!name) return toast("Give your goal a name", "err");
    if (!(target > 0)) return toast("Enter a target amount above 0", "err");
    if (!(saved >= 0)) return toast("Saved amount can't be negative", "err");
    if (!f.date) return toast("Pick a target date", "err");
    const body = { name, target_amount: target, saved_amount: saved, target_date: f.date };
    try {
      if (editing) await api(`/api/goals/${editing}`, { method: "PUT", body });
      else await api("/api/goals", { method: "POST", body });
      toast(editing ? "Goal updated" : "Goal added");
      setF(EMPTY); setEditing(null); load();
    } catch (x) { toast(x.message, "err"); }
  }
  function startEdit(g) {
    setEditing(g.id);
    setF({ name: g.name, target: String(g.target_amount), saved: String(g.saved_amount), date: g.target_date });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() { setEditing(null); setF(EMPTY); }
  async function addMoney(id, amount) {
    try { await api(`/api/goals/${id}/contribute`, { method: "POST", body: { amount } }); toast("Savings added"); load(); return true; } catch (x) { toast(x.message, "err"); return false; }
  }
  async function remove(g) {
    if (!window.confirm(`Delete the goal "${g.name}"?`)) return;
    try { await api(`/api/goals/${g.id}`, { method: "DELETE" }); toast("Goal deleted"); if (editing === g.id) cancelEdit(); load(); } catch (x) { toast(x.message, "err"); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Savings goals</h2>
        <p className="text-sm text-slate-500">Save for something specific and watch your progress</p>
      </div>

      <form onSubmit={save} className="card space-y-3">
        <p className="text-sm font-medium">{editing ? "Edit goal" : "New goal"}</p>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Goal name" placeholder="e.g. Laptop" maxLength={100} className="input !w-48" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input aria-label="Target amount" placeholder="Target ₹" inputMode="decimal" className="input !w-36" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />
          <input aria-label="Saved so far" placeholder="Saved so far ₹" inputMode="decimal" className="input !w-40" value={f.saved} onChange={(e) => setF({ ...f, saved: e.target.value })} />
          <input aria-label="Target date" type="date" className="input !w-auto" min={editing ? undefined : todayStr()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button className="btn">{editing ? "Update goal" : "Add goal"}</button>
          {editing && <button type="button" className="btn-ghost" onClick={cancelEdit}>Cancel</button>}
        </div>
      </form>

      {err ? <ErrorBox msg={err} retry={load} /> : !list ? <Skeleton className="h-40" /> : list.length === 0 ? <div className="card"><Empty>No goals yet. Add one above, like “Laptop, ₹50,000 by March”.</Empty></div> : list.map((g) => {
        const pct = Math.min(g.percent, 100);
        return (
          <div key={g.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{g.name}</p>
                <p className="text-xs text-slate-500">By {fmtDate(g.target_date)}{g.status === "active" && g.days_left >= 0 ? ` · ${g.days_left} day${g.days_left === 1 ? "" : "s"} left` : ""}</p>
              </div>
              <p className="text-sm">{inr(g.saved_amount)} / {inr(g.target_amount)} ({g.percent}%)</p>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${g.name} savings progress`}>
              <div className={`h-full transition-all ${BAR[g.status]}`} style={{ width: `${pct}%` }} />
            </div>
            {g.status === "done" && <p className="mt-2 text-xs text-emerald-600">🎉 Goal reached!</p>}
            {g.status === "overdue" && <p className="mt-2 text-xs text-red-600">⏰ The target date has passed. {inr(g.remaining)} still to go.</p>}
            {g.status === "active" && <p className="mt-2 text-xs text-slate-500">{inr(g.remaining)} to go · {g.months_left > 0 ? `save about ${inr(g.monthly_needed)} a month to finish on time` : `the full ${inr(g.monthly_needed)} is needed by the target date`}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {g.status !== "done" && <AddMoney onAdd={(n) => addMoney(g.id, n)} />}
              <button className="btn-ghost" onClick={() => startEdit(g)}>Edit</button>
              <button className="btn-ghost" onClick={() => remove(g)}>Delete</button>
            </div>
          </div>);
      })}
    </div>
  );
}
