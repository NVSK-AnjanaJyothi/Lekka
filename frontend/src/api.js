const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
export const thisMonth = () => new Date().toISOString().slice(0, 7);

export async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = localStorage.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw new Error("Cannot reach the server. Check your connection.");
  }
  if (res.status === 401 && token) { localStorage.removeItem("token"); window.location.href = "/login"; }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data.detail;
    throw new Error(typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => `${x.loc.slice(-1)}: ${x.msg}`).join("; ") : "Something went wrong");
  }
  return data;
}
