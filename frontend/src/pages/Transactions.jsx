import { useEffect, useState, useCallback } from "react";
import { api, inr } from "../api.js";
import { useToast, Skeleton, Empty, ErrorBox } from "../ui.jsx";

const PM = ["UPI", "Card", "Cash", "NetBanking", "Other"];
const blank = () => ({ type: "expense", amount: "", date: new Date().toISOString().slice(0, 10), category: "Food", merchant: "", note: "", payment_method: "UPI" });

function Form({ initial, cats, onSave, onCancel }) {
  const [f, setF] = useState({ ...initial, amount: String(initial.amount) });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  function submit(e) {
    e.preventDefault();
    const er = {};
    if (!(Number(f.amount) > 0)) er.amount = "Enter an amount above 0";
    if (!f.date) er.date = "Pick a date";
    setErr(er); if (Object.keys(er).length) return;
    onSave({ ...f, amount: Number(f.amount) });
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3" noValidate>
      <select aria-label="Type" className="input" value={f.type} onChange={set("type")}><option>expense</option><option>income</option></select>
      <div><input aria-label="Amount" aria-invalid={!!err.amount} placeholder="Amount ₹" inputMode="decimal" className="input" value={f.amount} onChange={set("amount")} />{err.amount && <p className="text-xs text-red-600">{err.amount}</p>}</div>
      <div><input aria-label="Date" type="date" className="input" value={f.date} onChange={set("date")} />{err.date && <p className="text-xs text-red-600">{err.date}</p>}</div>
      <select aria-label="Category" className="input" value={f.category} onChange={set("category")}>{cats.map((c) => <option key={c}>{c}</option>)}</select>
      <input aria-label="Merchant" placeholder="Merchant" maxLength={100} className="input" value={f.merchant} onChange={set("merchant")} />
      <select aria-label="Payment method" className="input" value={f.payment_method} onChange={set("payment_method")}>{PM.map((p) => <option key={p}>{p}</option>)}</select>
      <input aria-label="Note" placeholder="Note" maxLength={255} className="input sm:col-span-2" value={f.note} onChange={set("note")} />
      <div className="flex gap-2"><button className="btn">Save</button><button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

export function Transactions() {
  const toast = useToast();
  const [cats, setCats] = useState(["Other"]);
  const [filters, setFilters] = useState({ q: "", type: "", category: "", start: "", end: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(null);
  const [nl, setNl] = useState(""); const [nlBusy, setNlBusy] = useState(false);
  const [newCat, setNewCat] = useState("");

  const load = useCallback(() => {
    const p = new URLSearchParams({ page, page_size: 10, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
    setErr(""); api(`/api/transactions?${p}`).then(setData).catch((e) => setErr(e.message));
  }, [filters, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api("/api/categories").then(setCats).catch(() => {}); }, []);

  async function save(t) {
    try {
      if (editing.id) await api(`/api/transactions/${editing.id}`, { method: "PUT", body: t });
      else await api("/api/transactions", { method: "POST", body: t });
      toast("Saved"); setEditing(null); load();
    } catch (e) { toast(e.message, "err"); }
  }
  async function remove(id) {
    if (!confirm("Delete this transaction?")) return;
    try { await api(`/api/transactions/${id}`, { method: "DELETE" }); toast("Deleted"); load(); } catch (e) { toast(e.message, "err"); }
  }
  async function parse(e) {
    e.preventDefault(); setNlBusy(true);
    try {
      const r = await api("/api/ai/parse", { method: "POST", body: { text: nl } });
      setEditing({ ...blank(), ...r }); setNl("");
      if (r.source === "rules") toast("AI unavailable — used basic parsing. Please review.", "err");
    } catch (x) { toast(x.message, "err"); } finally { setNlBusy(false); }
  }
  async function importCsv(e) {
    const file = e.target.files[0]; if (!file) return;
    const form = new FormData(); form.append("file", file);
    try { const r = await api("/api/import/csv", { method: "POST", form }); toast(`Imported ${r.imported} rows${r.errors.length ? `, ${r.errors.length} skipped` : ""}`); load(); } catch (x) { toast(x.message, "err"); }
    e.target.value = "";
  }
  async function exportCsv() {
    const res = await fetch((import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "") + "/api/export/csv", { headers: { Authorization: `Bearer ${localStorage.token}` } });
    const url = URL.createObjectURL(await res.blob()); const a = document.createElement("a"); a.href = url; a.download = "spendwise.csv"; a.click(); URL.revokeObjectURL(url);
  }
  async function recategorize() {
    try { const r = await api("/api/ai/categorize", { method: "POST" }); toast(`Re-categorized ${r.updated} transactions`); load(); } catch (x) { toast(x.message, "err"); }
  }
  async function addCat(e) {
    e.preventDefault(); if (!newCat.trim()) return;
    try { setCats(await api("/api/categories", { method: "POST", body: { name: newCat } })); setNewCat(""); toast("Category added"); } catch (x) { toast(x.message, "err"); }
  }
  const setFilter = (k) => (e) => { setPage(1); setFilters({ ...filters, [k]: e.target.value }); };

  return (
    <div className="space-y-4">
      <form onSubmit={parse} className="card flex flex-col gap-2 sm:flex-row">
        <input aria-label="Describe a transaction" className="input" placeholder='Try: "paid 450 for Zomato yesterday via UPI"' value={nl} onChange={(e) => setNl(e.target.value)} minLength={3} required />
        <button className="btn whitespace-nowrap" disabled={nlBusy}>{nlBusy ? "Reading…" : "✨ Add with AI"}</button>
      </form>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => setEditing(blank())}>+ Add manually</button>
        <label className="btn-ghost cursor-pointer">Import CSV<input type="file" accept=".csv" hidden onChange={importCsv} /></label>
        <button className="btn-ghost" onClick={exportCsv}>Export CSV</button>
        <button className="btn-ghost" onClick={recategorize}>Auto-categorize "Other"</button>
        <form onSubmit={addCat} className="ml-auto flex gap-2"><input aria-label="New category" className="input w-40" placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={50} /><button className="btn-ghost">Add</button></form>
      </div>
      {editing && <div className="card"><Form initial={editing} cats={cats} onSave={save} onCancel={() => setEditing(null)} /></div>}
      <div className="card grid gap-2 sm:grid-cols-5">
        <input aria-label="Search" placeholder="Search…" className="input" value={filters.q} onChange={setFilter("q")} />
        <select aria-label="Type filter" className="input" value={filters.type} onChange={setFilter("type")}><option value="">All types</option><option>income</option><option>expense</option></select>
        <select aria-label="Category filter" className="input" value={filters.category} onChange={setFilter("category")}><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <input aria-label="From date" type="date" className="input" value={filters.start} onChange={setFilter("start")} />
        <input aria-label="To date" type="date" className="input" value={filters.end} onChange={setFilter("end")} />
      </div>
      {err ? <ErrorBox msg={err} retry={load} /> : !data ? <Skeleton className="h-64" /> : data.items.length === 0 ? <div className="card"><Empty>No transactions match.</Empty></div> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm"><caption className="sr-only">Transactions</caption>
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800"><tr>{["Date", "Merchant", "Category", "Method", "Amount", ""].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>{data.items.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800/60">
                <td className="px-4 py-3">{t.date}</td><td className="px-4 py-3">{t.merchant || t.note || "—"}</td><td className="px-4 py-3">{t.category}</td><td className="px-4 py-3">{t.payment_method}</td>
                <td className={`px-4 py-3 font-medium ${t.type === "income" ? "text-emerald-600" : ""}`}>{t.type === "income" ? "+" : "−"}{inr(t.amount)}</td>
                <td className="whitespace-nowrap px-4 py-3"><button className="btn-ghost mr-1" onClick={() => setEditing(t)} aria-label={`Edit ${t.merchant}`}>Edit</button><button className="btn-ghost" onClick={() => remove(t.id)} aria-label={`Delete ${t.merchant}`}>Delete</button></td>
              </tr>))}</tbody></table>
        </div>
      )}
      {data && <div className="flex items-center justify-between text-sm"><span>{data.total} transactions</span>
        <div className="flex gap-2"><button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button><span className="px-2 py-2">Page {page}</span><button className="btn-ghost" disabled={page * 10 >= data.total} onClick={() => setPage(page + 1)}>Next</button></div></div>}
    </div>
  );
}
