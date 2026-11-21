/* Pure product, selection and wallet-error rules for the Open Trade renderer.
 * No network, storage or wallet access lives here, so every rule is covered
 * by tests/desktop-model.test.mjs. The backend remains the only source of
 * record: these functions only decide what may be shown or requested. */

export const PRODUCTS = Object.freeze(["prop", "perpetual"]);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const WALLET = /^0x[0-9a-f]{40}$/;

export const isProduct = (value) => PRODUCTS.includes(value);

/** Simulated Prop accounts in the signed-in wallet's directory. */
export function propAccounts(accounts) {
  return (Array.isArray(accounts) ? accounts : []).filter(
    (a) => a?.product === "prop" && UUID.test(String(a.id)),
  );
}

/** The wallet's read-only Gains entry, only when it matches the session wallet. */
export function perpetualAccount(accounts, wallet) {
  const w = String(wallet || "").toLowerCase();
  if (!WALLET.test(w)) return null;
  return (
    (Array.isArray(accounts) ? accounts : []).find(
      (a) =>
        a?.product === "perpetual" &&
        String(a.id).toLowerCase() === `gains:arbitrum:${w}`,
    ) || null
  );
}

/** A stored selection is restored only if it still belongs to this directory. */
export function restoreSelection(saved, accounts, wallet) {
  if (!saved || typeof saved !== "object") return null;
  if (saved.wallet !== String(wallet || "").toLowerCase()) return null;
  if (saved.product === "perpetual") {
    const p = perpetualAccount(accounts, wallet);
    return p ? { product: "perpetual", account: p } : null;
  }
  if (saved.product === "prop") {
    const a = propAccounts(accounts).find((x) => x.id === saved.id);
    return a ? { product: "prop", account: a } : null;
  }
  return null;
}

/** Gains snapshots are shown only for the authenticated wallet. */
export function perpetualSnapshotFor(snapshot, wallet) {
  const w = String(wallet || "").toLowerCase();
  return !!snapshot &&
    snapshot.source === "gains:arbitrum" &&
    String(snapshot.wallet).toLowerCase() === w &&
    snapshot.capabilities?.readOnly === true
    ? snapshot
    : null;
}

/** Workspace preference key, separated by wallet and product. */
export function preferenceKey(name, { wallet, product }) {
  const w = WALLET.test(String(wallet || "").toLowerCase())
    ? String(wallet).toLowerCase()
    : "guest";
  return `ot-${isProduct(product) ? product : "explore"}-${w}-${name}`;
}

/** Trading controls are only ever enabled for a writable Prop account. */
export const canSimulateTrade = (product, account) =>
  product === "prop" && !!account && account.readOnly !== true;

/** Classify a wallet or sign-in failure into a stable, translatable code. */
export function walletErrorCode(error) {
  const code = error?.code ?? error?.cause?.code;
  const text = String(error?.message || error || "").toLowerCase();
  if (code === 4001 || code === 5000 || code === 5002 || /user rejected|rejected by user|user denied|request rejected|user disapproved/.test(text))
    return "rejected";
  if (/proposal expired|pairing expired|expired/.test(text)) return "expired";
  if (/project ?id|unauthorized|403|invalid key/.test(text)) return "project";
  if (/relay|websocket|socket stalled|network|fetch failed|failed to fetch/.test(text)) return "relay";
  if (/chain|arbitrum/.test(text)) return "chain";
  if (/mismatch/.test(text)) return "mismatch";
  return "unknown";
}
