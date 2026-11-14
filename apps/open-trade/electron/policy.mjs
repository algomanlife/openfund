export function backendOrigin(value) {
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/" ||
    !(
      u.protocol === "https:" ||
      (u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))
    )
  )
    throw new Error(
      "Use an HTTPS backend origin (HTTP is allowed only on loopback).",
    );
  return u.origin;
}
const reads = new Set([
  "/health",
  "/auth/me",
  "/accounts",
  "/trading/state",
  "/products/perpetual/gains",
]);
const writes = new Set([
  "/auth/nonce",
  "/auth/verify",
  "/auth/logout",
  "/trading/preview",
  "/trading/order",
]);
export function validateRequest(r) {
  if (!r || !["GET", "POST"].includes(r.method) || typeof r.path !== "string")
    throw new Error("Invalid request");
  const allowed =
    r.method === "GET"
      ? reads.has(r.path) ||
        /^\/products\/prop\/trades\/[a-f0-9-]{36}$/.test(r.path)
      : writes.has(r.path) ||
        /^\/trading\/(positions\/[a-f0-9-]{36}\/(close|protection)|orders\/[a-f0-9-]{36}\/cancel)$/.test(
          r.path,
        );
  if (!allowed || (r.account && !/^[a-f0-9-]{36}$/.test(r.account)))
    throw new Error("Unsupported operation");
  if (JSON.stringify(r.body || {}).length > 16384)
    throw new Error("Request too large");
  if (r.key && !/^[a-f0-9-]{36}$/.test(r.key))
    throw new Error("Invalid idempotency key");
  if ((r.path === "/trading/order" || r.path.endsWith("/close")) && !r.key)
    throw new Error("Idempotency key required");
  return r;
}
export const retryDelay = (attempt) =>
  Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
export function acceptSnapshot(previous, next) {
  return (
    !!next &&
    Number.isFinite(Number(next.as_of)) &&
    (!previous || Number(next.as_of) >= Number(previous.as_of))
  );
}
export function trustedFrame(url) {
  try {
    const u = new URL(url);
    return (
      u.origin === "open-trade://app" ||
      (u.protocol === "open-trade:" && u.host === "app")
    );
  } catch {
    return false;
  }
}
