import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useToast } from "../ui.jsx";
import { Icon, Logo, LogoMark } from "../icons.jsx";

const POINTS = ["Add expenses by typing a sentence", "Budgets with 80% and 100% alerts", "Ask questions, get exact ₹ answers"];

export function Login() {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const nav = useNavigate(); const toast = useToast();

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = "Enter a valid email";
    if (f.password.length < 6) er.password = "At least 6 characters";
    setErr(er); if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const r = await api(`/api/auth/${mode === "login" ? "login" : "signup"}`, { method: "POST", body: f });
      localStorage.token = r.access_token; nav("/");
    } catch (x) { toast(x.message, "err"); } finally { setBusy(false); }
  }
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-indigo-600 to-indigo-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5"><LogoMark className="h-10 w-10 rounded-xl ring-2 ring-white/40" /><span className="text-xl font-bold tracking-tight">Lekka</span></div>
        <div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">Know where every rupee goes.</h1>
          <p className="mt-4 max-w-md text-indigo-50/90">Track income and expenses in ₹, and let AI explain your spending with real numbers from your own data.</p>
          <ul className="mt-8 space-y-3">{POINTS.map((p) => <li key={p} className="flex items-center gap-3 text-sm"><span className="grid h-6 w-6 place-items-center rounded-full bg-white/20"><Icon name="check" className="h-3.5 w-3.5" /></span>{p}</li>)}</ul>
        </div>
        <p className="text-sm text-indigo-100/80">Lekka · Your money, explained</p>
      </div>
      <div className="flex min-h-screen items-center justify-center px-4 py-10 lg:min-h-0">
        <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-8" noValidate>
          <div className="lg:hidden"><Logo /></div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="mt-1 text-sm text-slate-500">{mode === "login" ? "Log in to see your dashboard" : "Start tracking your money in a minute"}</p>
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" type="email" className="input mt-1" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-invalid={!!err.email} />
            {err.email && <p className="mt-1 text-xs text-red-600">{err.email}</p>}
          </div>
          <div>
            <label htmlFor="pw" className="text-sm font-medium">Password</label>
            <input id="pw" type="password" className="input mt-1" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-invalid={!!err.password} />
            {err.password && <p className="mt-1 text-xs text-red-600">{err.password}</p>}
          </div>
          <button className="btn w-full py-2.5" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}</button>
          {mode === "login" && <button type="button" className="btn-ghost w-full" onClick={() => setF({ email: "demo@lekka.in", password: "demo1234" })}>Use demo account</button>}
          <button type="button" className="w-full text-sm text-indigo-600 hover:underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "New here? Sign up" : "Have an account? Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
