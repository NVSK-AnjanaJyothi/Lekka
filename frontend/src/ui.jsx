import { createContext, useContext, useState, useCallback } from "react";
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function Toasts({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((msg, kind = "ok") => {
    const id = Math.random();
    setList((l) => [...l, { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 space-y-2">
        {list.map((t) => (
          <div key={t.id} className={`rounded-lg px-4 py-2 text-sm text-white shadow-lg ${t.kind === "err" ? "bg-red-600" : "bg-emerald-600"}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const Skeleton = ({ className = "h-24" }) => <div className={`skeleton ${className}`} aria-hidden />;
export const Empty = ({ children }) => <p className="py-8 text-center text-sm text-slate-500">{children}</p>;
export const ErrorBox = ({ msg, retry }) => (
  <div role="alert" className="card text-center text-sm text-red-600">{msg} {retry && <button className="btn-ghost ml-2" onClick={retry}>Retry</button>}</div>
);
