import { useEffect, useState } from "react";
import { backendUrl } from "../../session/useOpenfundSession";
export type Product = "prop" | "perpetual";
export type Locale = "fa" | "en";
export const primary = {
  prop: [
    ["dashboard", "داشبورد", "Dashboard"],
    ["trade", "ترمینال پراپ", "Prop Terminal"],
    ["portfolio", "پورتفولیو", "Portfolio"],
    ["leaderboard", "لیدربورد", "Leaderboard"],
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
export const route = (locale: Locale, product: Product, page: string) =>
  `/${locale}/${product}/${page}`;
export async function api(
  product: Product,
  path: string,
  init: RequestInit = {},
) {
  const r = await fetch(`${backendUrl()}/products/${product}${path}`, {
    ...init,
    credentials: "include",
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
) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
    key?: string;
  }>({ data: null, loading: false, error: null });
  const key = `${product}:${path}:${revision}`;
  useEffect(() => {
    if (!path) {
      setState({ key, data: null, loading: false, error: null });
      return;
    }
    const ctrl = new AbortController();
    setState({ key, data: null, loading: true, error: null });
    api(product, path, { signal: ctrl.signal })
      .then((data) => {
        if (!ctrl.signal.aborted)
          setState({ key, data, loading: false, error: null });
      })
      .catch((e) => {
        if (!ctrl.signal.aborted)
          setState({ key, data: null, loading: false, error: e.message });
      });
    return () => ctrl.abort();
  }, [product, path, revision]);
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
