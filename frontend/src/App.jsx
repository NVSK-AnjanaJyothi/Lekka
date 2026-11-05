import { Component, useState } from "react";
import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { Toasts } from "./ui.jsx";
import { Login } from "./pages/Login.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Transactions } from "./pages/Transactions.jsx";
import { Budgets } from "./pages/Budgets.jsx";
import { Chat } from "./pages/Chat.jsx";

function Shell({ children }) {
  const nav = useNavigate();
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  const toggle = () => { const d = !dark; setDark(d); document.documentElement.classList.toggle("dark", d); localStorage.theme = d ? "dark" : "light"; };
  const link = ({ isActive }) => `rounded-lg px-3 py-1.5 text-sm ${isActive ? "bg-emerald-600 text-white" : "hover:bg-slate-200 dark:hover:bg-slate-800"}`;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-4">
        <h1 className="text-xl font-bold text-emerald-600">Spendwise</h1>
        <nav aria-label="Main" className="flex flex-wrap gap-1">
          <NavLink to="/" end className={link}>Dashboard</NavLink>
          <NavLink to="/transactions" className={link}>Transactions</NavLink>
          <NavLink to="/budgets" className={link}>Budgets</NavLink>
          <NavLink to="/chat" className={link}>Ask your money</NavLink>
        </nav>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={toggle} aria-label="Toggle dark mode">{dark ? "☀️" : "🌙"}</button>
          <button className="btn-ghost" onClick={() => { localStorage.removeItem("token"); nav("/login"); }}>Log out</button>
        </div>
      </header>
      <main><Boundary>{children}</Boundary></main>
    </div>
  );
}
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
const Guard = ({ children }) => (localStorage.token ? <Shell>{children}</Shell> : <Navigate to="/login" replace />);

export default function App() {
  return (
    <Toasts>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Guard><Dashboard /></Guard>} />
        <Route path="/transactions" element={<Guard><Transactions /></Guard>} />
        <Route path="/budgets" element={<Guard><Budgets /></Guard>} />
        <Route path="/chat" element={<Guard><Chat /></Guard>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Toasts>
  );
}
