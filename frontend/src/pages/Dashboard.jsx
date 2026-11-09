import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api, inr, thisMonth } from "../api.js";
import { Skeleton, ErrorBox, Empty } from "../ui.jsx";
import { Icon } from "../icons.jsx";

const monthLabel = (m) => { const mo = new Date(m + "-01T00:00:00").toLocaleString("en-US", { month: "short" }); return m.endsWith("-01") ? mo + " " + m.slice(2, 4) : mo; };
const short = (n) => "₹" + (n >= 1000 ? n / 1000 + "k" : n);
const legendText = (v) => <span className="text-slate-600 dark:text-slate-300">{v}</span>;
const axisProps = { tick: { fontSize: 12 }, tickMargin: 8 };
const COLORS = ["#6366F1", "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b"];

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
  const stats = t && [
    ["Income", inr(t.income), "trendUp", "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"],
    ["Expenses", inr(t.expense), "trendDown", "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"],
    ["Savings", inr(t.savings), "wallet", "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400"],
    ["Savings rate", t.savings_rate + "%", "percent", "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400"]];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-bold tracking-tight">Dashboard</h2><p className="text-sm text-slate-500">Your income, spending and savings at a glance</p></div>
        <label className="text-sm">Month <input type="month" className="input ml-2 inline w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {!d ? [0, 1, 2, 3].map((i) => <Skeleton key={i} />) : stats.map(([k, v, icon, tone]) => (
          <div key={k} className="card flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon name={icon} /></div><div className="min-w-0"><p className="text-sm text-slate-500">{k}</p><p className="text-xl font-bold tracking-tight sm:text-2xl">{v}</p></div></div>
        ))}
      </div>
      {!d ? <Skeleton className="h-72" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card flex h-96 flex-col"><h3 className="mb-2 font-semibold">Spending by category</h3>
            {d.by_category.length === 0 ? <Empty>No expenses this month.</Empty> : (
              <div className="min-h-0 flex-1"><ResponsiveContainer><PieChart><Pie data={d.by_category} dataKey="total" nameKey="category" innerRadius="55%" outerRadius="80%" cy="45%">
                {d.by_category.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={inr} labelFormatter={(l) => (/^\d{4}-\d{2}$/.test(l) ? monthLabel(l) + " " + l.slice(0, 4) : l)} /><Legend iconType="circle" iconSize={10} formatter={legendText} wrapperStyle={{ fontSize: 13 }} /></PieChart></ResponsiveContainer></div>)}
          </div>
          <div className="card flex h-96 flex-col"><h3 className="mb-2 font-semibold">Monthly spending trend</h3>
            <div className="min-h-0 flex-1"><ResponsiveContainer><LineChart data={d.monthly}><XAxis dataKey="month" tickFormatter={monthLabel} interval={0} padding={{ left: 16, right: 16 }} {...axisProps} /><YAxis tickFormatter={short} width={52} {...axisProps} /><Tooltip formatter={inr} labelFormatter={(l) => (/^\d{4}-\d{2}$/.test(l) ? monthLabel(l) + " " + l.slice(0, 4) : l)} /><Line dataKey="expense" stroke="#ef4444" strokeWidth={2} /></LineChart></ResponsiveContainer></div></div>
          <div className="card flex h-96 flex-col"><h3 className="mb-2 font-semibold">Income vs expense</h3>
            <div className="min-h-0 flex-1"><ResponsiveContainer><BarChart data={d.monthly}><XAxis dataKey="month" tickFormatter={monthLabel} interval={0} padding={{ left: 16, right: 16 }} {...axisProps} /><YAxis tickFormatter={short} width={52} {...axisProps} /><Tooltip formatter={inr} labelFormatter={(l) => (/^\d{4}-\d{2}$/.test(l) ? monthLabel(l) + " " + l.slice(0, 4) : l)} /><Legend iconType="circle" iconSize={10} formatter={legendText} wrapperStyle={{ fontSize: 13 }} /><Bar dataKey="income" fill="#10b981" /><Bar dataKey="expense" fill="#ef4444" /></BarChart></ResponsiveContainer></div></div>
          <div className="card overflow-auto lg:h-96"><h3 className="mb-2 font-semibold">Top merchants</h3>
            {d.top_merchants.length === 0 ? <Empty>No merchant data.</Empty> : <ol className="space-y-2">{d.top_merchants.map((m) => (
              <li key={m.merchant} className="flex justify-between text-sm"><span>{m.merchant}</span><span className="font-medium">{inr(m.total)}</span></li>))}</ol>}
          </div>
        </div>
      )}
      <div className="card">
        <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold"><span className="text-indigo-600"><Icon name="sparkles" className="h-5 w-5" /></span>AI insights</h3>
          <button className="btn" onClick={getInsights} disabled={insLoading}>{insLoading ? "Analysing…" : "Generate insights"}</button></div>
        {insLoading && <Skeleton className="mt-3 h-24" />}
        {ins && <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{ins.summary}{ins.source === "fallback" && <p className="mt-2 text-xs text-amber-600">Showing a basic summary because AI is unavailable.</p>}</div>}
      </div>
    </div>
  );
}
