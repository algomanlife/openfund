import { useEffect, useState } from "react";
import { useSession, backendUrl } from "../../session/useOpenfundSession";
export type Product = "prop" | "perpetual";
export type Locale = "fa" | "en";
export const primary = {
  prop: [
    ["dashboard", "داشبورد", "Dashboard"],
    ["trade", "ترمینال پراپ", "Prop Terminal"],
    ["portfolio", "پورتفولیو", "Portfolio"],
    ["leaderboard", "لیدربورد", "Leaderboard"],
    ["purchases", "خریدها و فاکتورها", "Purchases & Invoices"],
    ["withdrawals", "درخواست برداشت", "Withdrawal Requests"],
    ["certificates", "سرتیفیکیت‌ها", "Certificates"],
  ],
  perpetual: [
    ["dashboard", "داشبورد", "Dashboard"],
    ["trade", "ترمینال پرپچوال", "Perpetual Terminal"],
    ["portfolio", "پورتفولیو", "Portfolio"],
    ["leaderboard", "لیدربورد", "Leaderboard"],
    ["rewards", "ریوارد", "Rewards"],
  ],
} as const;
export const selectedAccount = () => new URLSearchParams(location.search).get('account');
export const route = (locale: Locale, product: Product, page: string) => {
  const account=location.pathname.includes(`/${product}/`) ? selectedAccount() : null;
  return `/${locale}/${product}/${page}${account ? `?account=${encodeURIComponent(account)}` : ''}`;
};
export function routeQuery(path: string, values: Record<string, string>) {
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(values)) params.set(key, value);
  return pathname + "?" + params;
}
export async function api(
  product: Product,
  path: string,
  init: RequestInit = {},
  accountScope?: string | null,
) {
  const account = accountScope !== undefined ? accountScope : location.pathname.includes(`/${product}/`) ? selectedAccount() : null;
  if(account) path += `${path.includes('?')?'&':'?'}account=${encodeURIComponent(account)}`;
  const r = await fetch(`${backendUrl()}/products/${product}${path}`, {
    ...init,
    credentials: "include",
    signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}
export function useResource<T = any>(
  product: Product,
  path: string | null,
  revision = 0,
  live = false,
) {
  const session = useSession();
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
    key?: string;
  }>({ data: null, loading: false, error: null });
  const key = `${session.user?.id}:${session.status}:${product}:${selectedAccount()}:${path}:${revision}`;
  useEffect(() => {
    if (!path) {
      setState({ key, data: null, loading: false, error: null });
      return;
    }
    const ctrl = new AbortController();
    setState({ key, data: null, loading: true, error: null });
    let busy = false;
    const load = async () => {
      if (busy || ctrl.signal.aborted) return;
      busy = true;
      try {
        const data = await api(product, path, { signal: ctrl.signal });
        if (!ctrl.signal.aborted) setState({ key, data, loading:false, error:null });
      } catch (e) {
        if (!ctrl.signal.aborted) setState({ key, data:null, loading:false, error:(e as Error).message });
      } finally { busy = false; }
    };
    void load();
    const changed=()=>{if(live)void load()};
    addEventListener('of-trading-update',changed);
    const timer = live ? setInterval(load, product === 'prop' ? 5000 : 15000) : null;
    return () => { ctrl.abort(); removeEventListener('of-trading-update',changed); if (timer) clearInterval(timer) };
  }, [key, live]);
  return state.key === key
    ? state
    : { data: null, loading: !!path, error: null };
}
export const money = (v: unknown) =>
  v == null || !Number.isFinite(Number(v))
    ? "—"
    : Number(v).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const csvCell = (v: unknown) =>
  `"${String(v ?? "")
    .replace(/^[=+@\-\t\r]/, (c) => `'${c}`)
    .replaceAll('"', '""')}"`;
