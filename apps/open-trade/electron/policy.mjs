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

/* ---- 0.0.3: configuration, response, link and update policy ---- */

/** Canonical regional backends (ADR 0043). A packaged build talks only to these. */
export const REGIONS = Object.freeze({
  international: "https://openfi.cloud",
  iran: "https://openfi.live",
});
const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];

/** Backend origin for this process. Packaged builds accept only the canonical
 * regional origins; development builds also accept loopback HTTP and any
 * HTTPS origin (for an isolated staging backend). Invalid values throw. */
export function resolveBackend(value, { packaged }) {
  const origin = backendOrigin(value);
  if (!packaged) return origin;
  if (Object.values(REGIONS).includes(origin)) return origin;
  throw new Error(
    "Packaged builds connect only to the canonical Openfund regions.",
  );
}

/** Loopback test backends are never canonical; used to label diagnostics. */
export const isLoopback = (origin) => {
  try {
    return LOOPBACK.includes(new URL(origin).hostname);
  } catch {
    return false;
  }
};

/** WalletConnect/Reown project IDs are public 32-character hex identifiers. */
export function projectIdStatus(value) {
  if (!value) return "missing";
  return /^[0-9a-f]{32}$/i.test(String(value)) ? "configured" : "invalid";
}

/** Largest JSON body the main process accepts from the backend. */
export const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

/** Parse a backend body, refusing oversized or non-object payloads.
 * Returns `{ ok: true, value }` or `{ ok: false, error }`. */
export function parseBody(text, max = MAX_RESPONSE_BYTES) {
  if (text === null || (typeof text === "string" && (text.length > max || new TextEncoder().encode(text).length > max)))
    return { ok: false, error: "Server response too large" };
  if (typeof text !== "string") return { ok: false, error: "Invalid server response" };
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? { ok: true, value }
      : { ok: false, error: "Invalid server response" };
  } catch {
    return { ok: false, error: "Invalid server response" };
  }
}

const REPOSITORY = "https://github.com/algomanlife/openfund";

/** Corresponding-source link (AGPL §6): the exact commit the build came from. */
export function sourceLink(sha) {
  return typeof sha === "string" && /^[0-9a-f]{40}$/.test(sha)
    ? `${REPOSITORY}/tree/${sha}/apps/open-trade`
    : `${REPOSITORY}/tree/main/apps/open-trade`;
}

/** External links the renderer may open. Anything else is refused. */
export function externalLink(target, { sha } = {}) {
  if (target === "vela") return "https://github.com/LuxAlgo/Vela";
  if (target === "source") return sourceLink(sha);
  if (target === "releases") return `${REPOSITORY}/releases`;
  if (typeof target === "string") {
    const tx = /^tx:(0x[0-9a-fA-F]{64})$/.exec(target);
    if (tx) return `https://arbiscan.io/tx/${tx[1]}`;
    const release = /^release:(open-trade-v\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)$/.exec(target);
    if (release) return `${REPOSITORY}/releases/tag/${release[1]}`;
  }
  throw new Error("Unsupported link");
}

/** Semantic-version comparison for x.y.z[-pre]; pre-releases sort first. */
export function compareVersions(a, b) {
  const parse = (v) => {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.]+))?$/.exec(String(v));
    if (!m) throw new Error("Invalid version " + v);
    return { core: [1, 2, 3].map((i) => Number(m[i])), pre: m[4] || "" };
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] - y.core[i];
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** Newest published Open Trade release newer than `current` for a channel.
 * Only non-draft GitHub Releases on `open-trade-v*` tags qualify; stable
 * ignores pre-releases. Nothing is downloaded or installed: the result only
 * drives a notification that opens the official release page. */
export function newerRelease(releases, current, channel) {
  if (!Array.isArray(releases) || channel === "development") return null;
  let best = null;
  for (const r of releases) {
    const m = /^open-trade-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)$/.exec(r?.tag_name || "");
    if (!m || r.draft === true) continue;
    if (channel === "stable" && r.prerelease === true) continue;
    if (compareVersions(m[1], current) <= 0) continue;
    if (!best || compareVersions(m[1], best.version) > 0)
      best = { version: m[1], tag: r.tag_name, prerelease: r.prerelease === true };
  }
  return best;
}
