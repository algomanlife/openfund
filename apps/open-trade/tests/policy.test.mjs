import test from "node:test";
import assert from "node:assert/strict";
import {
  backendOrigin,
  validateRequest,
  retryDelay,
  acceptSnapshot,
  trustedFrame,
} from "../electron/policy.mjs";
test("backend configuration rejects credential-bearing, insecure and path URLs", () => {
  for (const url of [
    "http://example.com",
    "file:///tmp/x",
    "https://u:p@host",
    "https://host/path",
    "https://host/?secret=x",
  ])
    assert.throws(() => backendOrigin(url));
  assert.equal(backendOrigin("https://openfi.cloud"), "https://openfi.cloud");
  assert.equal(backendOrigin("http://127.0.0.1:9011"), "http://127.0.0.1:9011");
});
test("renderer cannot reach arbitrary paths, inject queries or submit without a duplicate guard", () => {
  for (const r of [
    { method: "GET", path: "https://other.test" },
    { method: "GET", path: "/auth/me?x=1" },
    { method: "POST", path: "/internal/inject-price" },
    { method: "POST", path: "/trading/order", body: {} },
    { method: "GET", path: "/trading/state", account: "../admin" },
  ])
    assert.throws(() => validateRequest(r));
  assert.equal(
    validateRequest({
      method: "POST",
      path: "/trading/order",
      key: "00000000-0000-4000-8000-000000000001",
      body: { margin: 10 },
    }).path,
    "/trading/order",
  );
});
test("reconnect delay is bounded and snapshots do not move backwards", () => {
  assert.equal(retryDelay(100), 30000);
  assert.equal(acceptSnapshot({ as_of: 200 }, { as_of: 100 }), false);
  assert.equal(acceptSnapshot(null, { as_of: 200 }), true);
  assert.equal(acceptSnapshot(null, { as_of: "bad" }), false);
});
test("only the packaged application origin is trusted", () => {
  assert.equal(trustedFrame("open-trade://app/index.html"), true);
  for (const u of [
    "https://app/index.html",
    "open-trade://evil/index.html",
    "file:///app/index.html",
    "invalid",
  ])
    assert.equal(trustedFrame(u), false);
});
