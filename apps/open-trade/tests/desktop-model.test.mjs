import test from "node:test";
import assert from "node:assert/strict";
import {
  canSimulateTrade,
  perpetualAccount,
  perpetualSnapshotFor,
  preferenceKey,
  propAccounts,
  restoreSelection,
  walletErrorCode,
} from "../src/desktop-model.mjs";

const W = "0x" + "ab".repeat(20);
const OTHER = "0x" + "cd".repeat(20);
const PROP = { id: "00000000-0000-4000-8000-000000000001", product: "prop", name: "Challenge" };
const PERP = { id: `gains:arbitrum:${W}`, product: "perpetual", readOnly: true };
const directory = [PROP, PERP, { id: "bad", product: "prop" }, { id: `gains:arbitrum:${OTHER}`, product: "perpetual" }];

test("Prop and Perpetual entries are separated and wallet-scoped", () => {
  assert.deepEqual(propAccounts(directory), [PROP]);
  assert.equal(perpetualAccount(directory, W.toUpperCase().replace("0X", "0x")), PERP);
  assert.equal(perpetualAccount(directory, "not-a-wallet"), null);
  assert.equal(perpetualAccount([{ ...PERP, id: `gains:arbitrum:${OTHER}` }], W), null);
});

test("a stored selection is restored only for the same wallet and an owned account", () => {
  assert.deepEqual(restoreSelection({ wallet: W, product: "prop", id: PROP.id }, directory, W), { product: "prop", account: PROP });
  assert.deepEqual(restoreSelection({ wallet: W, product: "perpetual" }, directory, W), { product: "perpetual", account: PERP });
  assert.equal(restoreSelection({ wallet: OTHER, product: "prop", id: PROP.id }, directory, W), null);
  assert.equal(restoreSelection({ wallet: W, product: "prop", id: "00000000-0000-4000-8000-000000000999" }, directory, W), null);
  assert.equal(restoreSelection({ wallet: W, product: "admin" }, directory, W), null);
  assert.equal(restoreSelection("garbage", directory, W), null);
});

test("a Gains snapshot for another wallet, or one claiming write access, is discarded", () => {
  const snap = { source: "gains:arbitrum", wallet: W, capabilities: { readOnly: true } };
  assert.equal(perpetualSnapshotFor(snap, W), snap);
  assert.equal(perpetualSnapshotFor({ ...snap, wallet: OTHER }, W), null);
  assert.equal(perpetualSnapshotFor({ ...snap, capabilities: { readOnly: false } }, W), null);
  assert.equal(perpetualSnapshotFor({ ...snap, source: "openfund_challenge_simulation" }, W), null);
  assert.equal(perpetualSnapshotFor(null, W), null);
});

test("trading controls are never enabled for Perpetual or read-only Prop accounts", () => {
  assert.equal(canSimulateTrade("prop", PROP), true);
  assert.equal(canSimulateTrade("prop", { ...PROP, readOnly: true }), false);
  assert.equal(canSimulateTrade("perpetual", PERP), false);
  assert.equal(canSimulateTrade("perpetual", { ...PERP, readOnly: false }), false);
  assert.equal(canSimulateTrade("prop", null), false);
});

test("preferences are separated by wallet and product", () => {
  assert.equal(preferenceKey("layout", { wallet: W, product: "prop" }), `ot-prop-${W}-layout`);
  assert.notEqual(preferenceKey("layout", { wallet: W, product: "prop" }), preferenceKey("layout", { wallet: W, product: "perpetual" }));
  assert.equal(preferenceKey("layout", { wallet: "x", product: "evil" }), "ot-explore-guest-layout");
});

test("wallet failures map to stable, translatable codes", () => {
  assert.equal(walletErrorCode({ code: 4001, message: "User rejected the request." }), "rejected");
  assert.equal(walletErrorCode(new Error("Proposal expired")), "expired");
  assert.equal(walletErrorCode(new Error("project id missing")), "project");
  assert.equal(walletErrorCode(new Error("WebSocket connection closed abnormally with code: 3000 (Unauthorized: invalid key)")), "project");
  assert.equal(walletErrorCode(new Error("Socket stalled when trying to connect to wss://relay.walletconnect.org")), "relay");
  assert.equal(walletErrorCode(new Error("Arbitrum One is required.")), "chain");
  assert.equal(walletErrorCode(new Error("Verified wallet session mismatch")), "mismatch");
  assert.equal(walletErrorCode(undefined), "unknown");
});
