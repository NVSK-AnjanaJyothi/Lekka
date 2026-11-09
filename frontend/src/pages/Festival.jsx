import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, inr, thisMonth } from "../api.js";
import { useToast, Skeleton, Empty, ErrorBox } from "../ui.jsx";

const SUGGESTIONS = ["Diwali", "Wedding season", "Eid", "Christmas", "Pongal", "Onam", "Durga Puja", "Holi", "Ganesh Chaturthi"];
const monthName = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
const sign = (n) => (n > 0 ? "+" : "");
const pctText = (p) => (p === null || p === undefined ? "—" : `${sign(p)}${p}%`);
const pctColor = (p) => (p > 0 ? "text-red-600" : p < 0 ? "text-emerald-600" : "text-slate-500");
const STATUS_TEXT = {
  in_progress: "This month isn't over yet",
  upcoming: "Upcoming month",
  no_data: "No spending recorded",
};

export function Festival() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [includeCurrent, setIncludeCurrent] = useState(false);
  const [f, setF] = useState({ month: thisMonth(), label: "Diwali" });

  const load = () => {
    setErr("");
    api(`/api/festival/compare?include_current=${includeCurrent}`).then(setData).catch((e) => setErr(e.message));
  };
  useEffect(() => { load(); }, [includeCurrent]);

  async function save(e) {
    e.preventDefault();
    const label = f.label.trim();
    if (!f.month) return toast("Pick a month", "err");
    if (!label) return toast("Enter a name, like Diwali", "err");
    try {
      await api("/api/festival-months", { method: "PUT", body: { month: f.month, label } });
      toast("Festival month saved");
      load();
    } catch (x) { toast(x.message, "err"); }
  }
  async function remove(id) {
    try { await api(`/api/festival-months/${id}`, { method: "DELETE" }); toast("Removed"); load(); } catch (x) { toast(x.message, "err"); }
  }

  const ready = data && data.festival_count > 0 && data.normal_count > 0;
  const chart = ready ? data.by_category.map((r) => ({ category: r.category, "Festival months": r.festival_avg, "Normal months": r.normal_avg })) : [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Festival months</h2>
        <p className="text-sm text-slate-500">Mark months like Diwali or wedding season and see how your spending compares with normal months</p>
      </div>

      <form onSubmit={save} className="card flex flex-wrap items-center gap-2">
        <input aria-label="Month" type="month" className="input !w-auto" value={f.month} onChange={(e) => e.target.value && setF({ ...f, month: e.target.value })} />
        <input aria-label="Festival name" list="festival-suggestions" placeholder="Diwali, wedding season…" maxLength={50} className="input !w-56" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
        <datalist id="festival-suggestions">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
        <button className="btn">Mark as festival month</button>
      </form>

      {err ? <ErrorBox msg={err} retry={load} /> : !data ? <Skeleton className="h-64" /> : (
        <>
          {data.festival_months.length === 0 ? (
            <div className="card"><Empty>No festival months yet. Pick a month above and give it a name, like Diwali.</Empty></div>
          ) : (
            <div className="card">
              <h3 className="font-semibold">Your festival months</h3>
              <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
                {data.festival_months.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div className="flex items-center gap-2"><span className="badge">{m.label}</span><span className="text-slate-500">{monthName(m.month)}</span></div>
                    <div className="flex items-center gap-3">
                      {m.status === "counted" ? (
                        <span>{inr(m.total)} {m.vs_normal_percent !== null && <span className={`text-xs ${pctColor(m.vs_normal_percent)}`}>({pctText(m.vs_normal_percent)} vs normal)</span>}</span>
                      ) : m.total !== null ? (
                        <span>{inr(m.total)} <span className="text-xs text-slate-500">so far · {STATUS_TEXT[m.status]}</span></span>
                      ) : <span className="text-xs text-slate-500">{STATUS_TEXT[m.status]}</span>}
                      <button className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => remove(m.id)} aria-label={`Remove ${m.label} ${monthName(m.month)}`}>Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.festival_months.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={includeCurrent} onChange={(e) => setIncludeCurrent(e.target.checked)} />
              Include this month, even though it isn't over yet
            </label>
          )}

          {data.festival_months.length > 0 && !ready && (
            <div className="card"><Empty>
              {data.festival_count === 0
                ? "No finished festival month has spending yet, so there is nothing to compare."
                : "You need at least one normal month with spending to compare against."}
              {!includeCurrent && " Only finished months are compared."}
            </Empty></div>
          )}

          {ready && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="card"><p className="text-sm text-slate-500">Festival month average</p><p className="mt-1 text-2xl font-bold">{inr(data.festival_avg)}</p><p className="text-xs text-slate-500">across {data.festival_count} month{data.festival_count > 1 ? "s" : ""}</p></div>
                <div className="card"><p className="text-sm text-slate-500">Normal month average</p><p className="mt-1 text-2xl font-bold">{inr(data.normal_avg)}</p><p className="text-xs text-slate-500">across {data.normal_count} month{data.normal_count > 1 ? "s" : ""}</p></div>
                <div className="card"><p className="text-sm text-slate-500">Difference</p>
                  <p className={`mt-1 text-2xl font-bold ${pctColor(data.difference)}`}>{sign(data.difference)}{inr(data.difference)}</p>
                  <p className={`text-xs ${pctColor(data.percent)}`}>{pctText(data.percent)} compared with a normal month</p></div>
              </div>

              <div className="card">
                <h3 className="font-semibold">Average spending by category</h3>
                <div className="mt-3 h-72" role="img" aria-label="Bar chart comparing average spending per category in festival months and normal months">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.3} />
                      <XAxis dataKey="category" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => inr(v)} width={72} />
                      <Tooltip formatter={(v) => inr(v)} />
                      <Legend />
                      <Bar dataKey="Normal months" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Festival months" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-slate-500"><th className="py-2 font-medium">Category</th><th className="py-2 text-right font-medium">Normal month</th><th className="py-2 text-right font-medium">Festival month</th><th className="py-2 text-right font-medium">Change</th></tr></thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {data.by_category.map((r) => (
                      <tr key={r.category}>
                        <td className="py-2">{r.category}</td>
                        <td className="py-2 text-right">{inr(r.normal_avg)}</td>
                        <td className="py-2 text-right">{inr(r.festival_avg)}</td>
                        <td className={`py-2 text-right ${pctColor(r.difference)}`}>{r.percent === null ? (r.difference > 0 ? "new" : "—") : pctText(r.percent)}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
