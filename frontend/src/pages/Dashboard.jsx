import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api, inr, thisMonth } from "../api.js";
import { Skeleton, ErrorBox, Empty } from "../ui.jsx";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b"];

export function Dashboard() {
  const [month, setMonth] = useState(thisMonth());
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [ins, setIns] = useState(null);
  const [insLoading, setInsLoading] = useState(false);

  const load = () => { setD(null); setErr(""); api(`/api/dashboard?month=${month}`).then(setD).catch((e) => setErr(e.message)); };
  useEffect(() => { load(); setIns(null); }, [month]);

  async function getInsights() {
    setInsLoading(true);
    try { setIns(await api(`/api/ai/insights?month=${month}`)); } catch (e) { setIns({ summary: e.message, source: "fallback" }); }
    setInsLoading(false);
  }
  if (err) return <ErrorBox msg={err} retry={load} />;
  const t = d?.totals;
  const stats = t && [["Income", inr(t.income)], ["Expenses", inr(t.expense)], ["Savings", inr(t.savings)], ["Savings rate", t.savings_rate + "%"]];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Overview</h2>
        <label className="text-sm">Month <input type="month" className="input ml-2 inline w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {!d ? [0, 1, 2, 3].map((i) => <Skeleton key={i} />) : stats.map(([k, v]) => (
          <div key={k} className="card"><p className="text-sm text-slate-500">{k}</p><p className="mt-1 text-2xl font-bold">{v}</p></div>
        ))}
      </div>
      {!d ? <Skeleton className="h-72" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card h-80"><h3 className="mb-2 font-medium">Spending by category</h3>
            {d.by_category.length === 0 ? <Empty>No expenses this month.</Empty> : (
              <ResponsiveContainer><PieChart><Pie data={d.by_category} dataKey="total" nameKey="category" innerRadius={55} outerRadius={90}>
                {d.by_category.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={inr} /><Legend /></PieChart></ResponsiveContainer>)}
          </div>
          <div className="card h-80"><h3 className="mb-2 font-medium">Monthly spending trend</h3>
            <ResponsiveContainer><LineChart data={d.monthly}><XAxis dataKey="month" /><YAxis tickFormatter={inr} width={70} /><Tooltip formatter={inr} /><Line dataKey="expense" stroke="#ef4444" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
          <div className="card h-80"><h3 className="mb-2 font-medium">Income vs expense</h3>
            <ResponsiveContainer><BarChart data={d.monthly}><XAxis dataKey="month" /><YAxis tickFormatter={inr} width={70} /><Tooltip formatter={inr} /><Legend /><Bar dataKey="income" fill="#10b981" /><Bar dataKey="expense" fill="#ef4444" /></BarChart></ResponsiveContainer></div>
          <div className="card h-80 overflow-auto"><h3 className="mb-2 font-medium">Top merchants</h3>
            {d.top_merchants.length === 0 ? <Empty>No merchant data.</Empty> : <ol className="space-y-2">{d.top_merchants.map((m) => (
              <li key={m.merchant} className="flex justify-between text-sm"><span>{m.merchant}</span><span className="font-medium">{inr(m.total)}</span></li>))}</ol>}
          </div>
        </div>
      )}
      <div className="card">
        <div className="flex items-center justify-between"><h3 className="font-medium">AI insights</h3>
          <button className="btn" onClick={getInsights} disabled={insLoading}>{insLoading ? "Analysing…" : "Generate insights"}</button></div>
        {insLoading && <Skeleton className="mt-3 h-24" />}
        {ins && <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{ins.summary}{ins.source === "fallback" && <p className="mt-2 text-xs text-amber-600">Showing a basic summary because AI is unavailable.</p>}</div>}
      </div>
    </div>
  );
}
