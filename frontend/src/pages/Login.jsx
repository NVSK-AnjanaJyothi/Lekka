import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useToast } from "../ui.jsx";

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
    <div className="mx-auto mt-24 max-w-sm px-4">
      <form onSubmit={submit} className="card space-y-4" noValidate>
        <h1 className="text-2xl font-bold text-emerald-600">Spendwise</h1>
        <p className="text-sm text-slate-500">{mode === "login" ? "Welcome back" : "Create your account"}</p>
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
        <button className="btn w-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}</button>
        <button type="button" className="w-full text-sm text-emerald-600" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "New here? Sign up" : "Have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
