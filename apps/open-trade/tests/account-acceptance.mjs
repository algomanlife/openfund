import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
export async function accountAcceptance(page, base) {
  const url = new URL(base);
  assert.ok(
    ["localhost", "127.0.0.1"].includes(url.hostname),
    "Automated trades require a loopback test backend",
  );
  const wallet = privateKeyToAccount(generatePrivateKey());
  const desktop = (r) => page.evaluate((r) => window.desktop.request(r), r);
  const call = (path, body, account, key) =>
    desktop({
      path,
      method: body === undefined ? "GET" : "POST",
      body,
      account,
      key,
    });
  const web = async (path, body, cookie) => {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  };
  const credentials = async () => {
    const n = await call("/auth/nonce", { address: wallet.address });
    assert.equal(n.ok, true);
    const message = createSiweMessage({
      address: wallet.address,
      chainId: 42161,
      domain: url.host,
      uri: base,
      nonce: n.data.nonce,
      version: "1",
      issuedAt: new Date(),
    });
    return { message, signature: await wallet.signMessage({ message }) };
  };
  const auth = await credentials();
  const wrong = privateKeyToAccount(generatePrivateKey());
  assert.equal(
    (
      await call("/auth/verify", {
        message: auth.message,
        signature: await wrong.signMessage({ message: auth.message }),
      })
    ).status,
    401,
  );
  assert.equal((await call("/auth/verify", auth)).ok, true);
  assert.equal((await call("/auth/verify", auth)).status, 400);
  const me = await call("/auth/me");
  assert.equal(me.data.user.walletAddress, wallet.address.toLowerCase());
  assert.equal(JSON.stringify(me).includes("openfund_session"), false);
  const browser = await web("/auth/verify", await credentials());
  assert.equal(browser.status, 200);
  const directory = await call("/accounts"),
    account = directory.data.accounts.find((a) => a.type === "free_trial").id;
  assert.equal(
    (
      await call(
        "/trading/state",
        undefined,
        "00000000-0000-4000-8000-000000000001",
      )
    ).status,
    404,
  );
  async function price() {
    const r = await web("/internal/inject-price", {
      symbol: "BTC/USD",
      price: "60000",
      metadata: { base: "BTC", group: "crypto", maxLeverage: 100 },
    });
    assert.equal(r.status, 200);
  }
  await price();
  const timer = setInterval(() => void price(), 1000);
  try {
    const order = {
      market: "BTC/USD",
      side: "long",
      order_type: "market",
      margin: "100",
      leverage: 10,
      sl: null,
      tp: null,
      product: "prop",
    };
    assert.equal((await call("/trading/preview", order, account)).ok, true);
    const key = crypto.randomUUID();
    const fill = await call("/trading/order", order, account, key);
    assert.equal(fill.ok, true, JSON.stringify(fill));
    const duplicate = await call("/trading/order", order, account, key);
    assert.equal(duplicate.ok, true);
    const state = await call("/trading/state", undefined, account);
    assert.equal(state.data.positions.length, 1);
    const p = state.data.positions[0];
    const browserState = await web(
      "/trading/state?account=" + account,
      null,
      browser.cookie,
    );
    assert.equal(browserState.data.positions[0].id, p.id);
    assert.equal(
      (
        await call(
          `/trading/positions/${p.id}/protection`,
          { sl: 59000, tp: 62000 },
          account,
        )
      ).ok,
      true,
    );
    const updated = await web(
      "/trading/state?account=" + account,
      null,
      browser.cookie,
    );
    assert.equal(Number(updated.data.positions[0].sl_price), 59000);
    assert.equal(
      (
        await call(
          `/trading/positions/${p.id}/protection`,
          { sl: 61000, tp: null },
          account,
        )
      ).ok,
      false,
    );
    await page
      .getByRole("button", { name: "Retry connection", exact: true })
      .click();
    await page.getByRole("button", { name: /Free Trial/ }).click();
    await page.waitForFunction(() =>
      document.querySelector("tbody")?.textContent?.includes("BTC/USD"),
    );
    await page.screenshot({ path: "artifacts/test-account.png" });
    assert.equal(
      (
        await call(
          `/trading/positions/${p.id}/close`,
          { fraction: 1 },
          account,
          crypto.randomUUID(),
        )
      ).ok,
      true,
    );
    assert.equal(
      (await call("/trading/state", undefined, account)).data.positions.length,
      0,
    );
    assert.equal((await call("/auth/logout", {})).ok, true);
    assert.equal((await call("/auth/me")).status, 401);
    assert.equal(
      (await web("/auth/me", null, browser.cookie)).status,
      200,
      "Desktop logout must not revoke the separate web session",
    );
    await web("/auth/logout", {}, browser.cookie);
  } finally {
    clearInterval(timer);
  }
  console.log(
    "PASS: generated-signature SIWE, replay/wrong signer, ownership, shared web/desktop state, duplicate prevention, SL/TP validation, close and independent logout",
  );
}
