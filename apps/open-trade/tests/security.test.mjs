/* Electron boundary rules added in 0.0.3 (policy.mjs). The existing
 * policy.test.mjs keeps the 0.0.2 request, origin and frame checks. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REGIONS,
  compareVersions,
  externalLink,
  newerRelease,
  parseBody,
  projectIdStatus,
  resolveBackend,
  validateRequest,
} from "../electron/policy.mjs";

test("packaged builds accept only the canonical regional backends", () => {
  assert.equal(resolveBackend("https://openfi.cloud", { packaged: true }), REGIONS.international);
  assert.equal(resolveBackend("https://openfi.live/", { packaged: true }), REGIONS.iran);
  for (const url of ["https://evil.example", "http://127.0.0.1:9011", "https://openfi.cloud.evil.example"])
    assert.throws(() => resolveBackend(url, { packaged: true }));
  assert.equal(resolveBackend("http://127.0.0.1:9011", { packaged: false }), "http://127.0.0.1:9011");
  assert.throws(() => resolveBackend("http://staging.example", { packaged: false }));
});

test("WalletConnect project ID absence and malformed values are reported, never guessed", () => {
  assert.equal(projectIdStatus(""), "missing");
  assert.equal(projectIdStatus(undefined), "missing");
  assert.equal(projectIdStatus("not-a-project"), "invalid");
  assert.equal(projectIdStatus("0123456789abcdef0123456789abcdef"), "configured");
});

test("malformed and oversized backend responses are refused", () => {
  assert.deepEqual(parseBody('{"ok":true}'), { ok: true, value: { ok: true } });
  assert.equal(parseBody("<html>").ok, false);
  assert.equal(parseBody("[1,2]").ok, false);
  assert.equal(parseBody("null").ok, false);
  assert.equal(parseBody(null).error, "Server response too large");
  assert.equal(parseBody(JSON.stringify({ x: "a".repeat(100) }), 50).error, "Server response too large");
});

test("Perpetual reads go through the existing backend boundary without an account or query", () => {
  assert.equal(validateRequest({ method: "GET", path: "/products/perpetual/gains" }).path, "/products/perpetual/gains");
  for (const r of [
    { method: "GET", path: "/products/perpetual/gains", account: `gains:arbitrum:0x${"a".repeat(40)}` },
    { method: "GET", path: "/products/perpetual/gains?cursor=1" },
    { method: "POST", path: "/products/perpetual/gains" },
    { method: "POST", path: "/products/perpetual/trade" },
  ])
    assert.throws(() => validateRequest(r));
});

test("only allowlisted external links open; transaction links require a real hash", () => {
  const sha = "a".repeat(40);
  assert.equal(externalLink("source", { sha }), `https://github.com/algomanlife/openfund/tree/${sha}/apps/open-trade`);
  assert.equal(externalLink("source", {}), "https://github.com/algomanlife/openfund/tree/main/apps/open-trade");
  assert.equal(externalLink("tx:0x" + "b".repeat(64)), "https://arbiscan.io/tx/0x" + "b".repeat(64));
  assert.equal(externalLink("release:open-trade-v0.0.3"), "https://github.com/algomanlife/openfund/releases/tag/open-trade-v0.0.3");
  for (const bad of ["tx:0x123", "tx:javascript:alert(1)", "https://evil.example", "release:v0.7.0", "release:open-trade-v1/../../x", "file:///etc/passwd"])
    assert.throws(() => externalLink(bad));
});

test("update notifications pick only newer, published, channel-appropriate desktop releases", () => {
  assert.ok(compareVersions("0.0.10", "0.0.9") > 0);
  assert.ok(compareVersions("0.0.3-rc.1", "0.0.3") < 0);
  const releases = [
    { tag_name: "v0.8.0" },
    { tag_name: "open-trade-v0.0.2" },
    { tag_name: "open-trade-v0.0.5", draft: true },
    { tag_name: "open-trade-v0.0.4-rc.1", prerelease: true },
    { tag_name: "open-trade-v0.0.4" },
  ];
  assert.deepEqual(newerRelease(releases, "0.0.3", "stable"), { version: "0.0.4", tag: "open-trade-v0.0.4", prerelease: false });
  assert.equal(newerRelease(releases.slice(0, 4), "0.0.3", "stable"), null);
  assert.equal(newerRelease(releases.slice(0, 4), "0.0.3", "beta").tag, "open-trade-v0.0.4-rc.1");
  assert.equal(newerRelease(releases, "0.0.3", "development"), null);
  assert.equal(newerRelease("not a list", "0.0.3", "stable"), null);
});

test("main process keeps the hardened window, denies permissions and never auto-installs updates", () => {
  const main = readFileSync(new URL("../electron/main.ts", import.meta.url), "utf8");
  for (const required of [
    "sandbox: true", "contextIsolation: true", "nodeIntegration: false", "webSecurity: true",
    'setWindowOpenHandler(() => ({ action: "deny" }))', '"will-navigate", (e) => e.preventDefault()',
    "callback(false)", 'redirect: "error"', "readLimited(", "resolveBackend(",
  ])
    assert.ok(main.includes(required), `missing: ${required}`);
  for (const forbidden of ["autoUpdater", "electron-updater", "rejectUnauthorized", "setCertificateVerifyProc", "nodeIntegration: true", "basic_text\" ||"])
    assert.ok(!main.includes(forbidden), `forbidden: ${forbidden}`);
  /* session tokens never reach the renderer */
  const config = main.slice(main.indexOf('handle("config"'), main.indexOf('handle("check-updates"'));
  assert.ok(!/token/.test(config), "config IPC must not expose the session token");
});
