import { Component, useEffect, useState } from "react";
import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { api } from "./api.js";
import { Toasts } from "./ui.jsx";
import { Icon, Logo } from "./icons.jsx";
import { Login } from "./pages/Login.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Transactions } from "./pages/Transactions.jsx";
import { Budgets } from "./pages/Budgets.jsx";
import { Festival } from "./pages/Festival.jsx";
import { Goals } from "./pages/Goals.jsx";
import { Chat } from "./pages/Chat.jsx";

const NAV = [["/", "Dashboard", "grid", true], ["/transactions", "Transactions", "swap"], ["/budgets", "Budgets", "target"], ["/festival", "Festival months", "calendar"], ["/goals", "Savings goals", "flag"], ["/chat", "Ask your money", "chat"]];

class Boundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error("UI crash:", err); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div role="alert" className="card mt-8 text-center">
        <p className="font-medium">Something went wrong on this page.</p>
        <p className="mt-1 text-xs text-slate-500">{String(this.state.err.message || this.state.err)}</p>
        <button className="btn mt-3" onClick={() => this.setState({ err: null })}>Try again</button>
      </div>
    );
  }
}

function Shell({ children }) {
  const nav = useNavigate();
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  const [email, setEmail] = useState("");
  const [desk, setDesk] = useState(localStorage.sidebar !== "closed"); // sidebar on large screens
  const [mob, setMob] = useState(false); // sidebar drawer on small screens
  useEffect(() => { api("/api/me").then((r) => setEmail(r.email)).catch(() => {}); }, []);
  const toggleTheme = () => { const d = !dark; setDark(d); document.documentElement.classList.toggle("dark", d); localStorage.theme = d ? "dark" : "light"; };
  const toggleMenu = () => {
    if (window.innerWidth >= 1024) { const next = !desk; setDesk(next); localStorage.sidebar = next ? "open" : "closed"; }
    else setMob(!mob);
  };
  const logout = () => { localStorage.removeItem("token"); nav("/login"); };
  const link = ({ isActive }) => `flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`;
  return (
    <div className="min-h-screen">
      {mob && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMob(false)} aria-hidden="true" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col justify-between border-r border-slate-200 bg-white p-4 transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 ${mob ? "translate-x-0" : "-translate-x-full"} ${desk ? "lg:translate-x-0" : "lg:-translate-x-full"}`}>
        <div>
        <div className="flex items-center justify-between px-2 py-2">
          <Logo />
          <button className="btn-ghost !px-2.5" onClick={toggleMenu} aria-label="Close menu"><Icon name="menu" className="h-5 w-5" /></button>
        </div>
        <nav aria-label="Main" className="mt-6 space-y-1">
          {NAV.map(([to, label, icon, end]) => <NavLink key={to} to={to} end={end} onClick={() => setMob(false)} className={link}><Icon name={icon} className="h-[18px] w-[18px]" />{label}</NavLink>)}
        </nav>
        </div>
        <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="flex items-center gap-3 px-1">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-semibold uppercase text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400">{(email || "U")[0]}</div>
            <p className="truncate text-sm text-slate-600 dark:text-slate-300">{email}</p>
          </div>
          <button className="btn-ghost w-full" onClick={logout}>Log out</button>
        </div>
      </aside>
      <div className={`min-w-0 transition-[padding] duration-200 ${desk ? "lg:pl-64" : ""}`}>
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 lg:px-8">
          <button className={`btn-ghost !px-2.5 ${desk ? "lg:hidden" : ""}`} onClick={toggleMenu} aria-label="Open menu" aria-expanded={window.innerWidth >= 1024 ? desk : mob}><Icon name="menu" className="h-5 w-5" /></button>
          <div className={desk ? "lg:hidden" : ""}><Logo /></div>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn-ghost !px-2.5" onClick={toggleTheme} aria-label="Toggle dark mode"><Icon name={dark ? "sun" : "moon"} className="h-4 w-4" /></button>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-semibold uppercase text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400" title={email} aria-label="Profile">{(email || "U")[0]}</div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8"><Boundary>{children}</Boundary></main>
      </div>
    </div>
  );
}
const Guard = ({ children }) => (localStorage.token ? <Shell>{children}</Shell> : <Navigate to="/login" replace />);

export default function App() {
  return (
    <Toasts>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Guard><Dashboard /></Guard>} />
        <Route path="/transactions" element={<Guard><Transactions /></Guard>} />
        <Route path="/budgets" element={<Guard><Budgets /></Guard>} />
        <Route path="/festival" element={<Guard><Festival /></Guard>} />
        <Route path="/goals" element={<Guard><Goals /></Guard>} />
        <Route path="/chat" element={<Guard><Chat /></Guard>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Toasts>
  );
}
