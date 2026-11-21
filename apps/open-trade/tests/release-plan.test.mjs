import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { missingCredentials, packagingPlan } from "../scripts/release-plan.mjs";

const mac = { CSC_LINK: "base64", CSC_KEY_PASSWORD: "x", APPLE_API_KEY: "k", APPLE_API_KEY_ID: "id", APPLE_API_ISSUER: "iss" };
const azure = {
  AZURE_TENANT_ID: "t", AZURE_CLIENT_ID: "c", AZURE_CLIENT_SECRET: "s",
  OPEN_TRADE_WIN_SIGN_ENDPOINT: "https://eus.codesigning.azure.net", OPEN_TRADE_WIN_SIGN_ACCOUNT: "a",
  OPEN_TRADE_WIN_SIGN_PROFILE: "p", OPEN_TRADE_WIN_PUBLISHER: "Openfund",
};

test("internal builds are explicitly unsigned and say so in the file name", () => {
  for (const platform of ["mac", "win", "linux"]) {
    const plan = packagingPlan({ channel: "internal", platform, env: mac });
    assert.equal(plan.signed, false);
    assert.ok(plan.args.some((a) => a.includes("internal-unsigned")));
    assert.ok(plan.args.includes("--publish") && plan.args.includes("never"));
  }
  assert.ok(packagingPlan({ channel: "internal", platform: "mac" }).args.includes("-c.mac.identity=null"));
});

test("beta and stable refuse to package without signing credentials", () => {
  assert.throws(() => packagingPlan({ channel: "stable", platform: "mac", env: {} }), /must be signed/);
  assert.throws(() => packagingPlan({ channel: "beta", platform: "win", env: {} }), /must be signed/);
  assert.throws(() => packagingPlan({ channel: "stable", platform: "mac", env: { ...mac, APPLE_API_ISSUER: "" } }), /APPLE_API_ISSUER/);
  assert.throws(() => packagingPlan({ channel: "nightly", platform: "mac" }));
});

test("signed macOS builds enable hardened runtime and required notarization", () => {
  const plan = packagingPlan({ channel: "stable", platform: "mac", env: mac });
  assert.equal(plan.signed, true);
  for (const a of ["-c.mac.hardenedRuntime=true", "-c.mac.notarize=true", "-c.mac.entitlements=build/entitlements.mac.plist"])
    assert.ok(plan.args.includes(a), a);
  assert.ok(!plan.args.some((a) => a.includes("unsigned")));
  assert.deepEqual(missingCredentials("mac", { ...mac, APPLE_API_KEY: "", APPLE_ID: "a", APPLE_APP_SPECIFIC_PASSWORD: "b", APPLE_TEAM_ID: "c" }), []);
});

test("Windows signs through Artifact Signing or an owner certificate", () => {
  const plan = packagingPlan({ channel: "stable", platform: "win", env: azure });
  assert.ok(plan.args.includes("-c.win.azureSignOptions.publisherName=Openfund"));
  assert.deepEqual(missingCredentials("win", { WIN_CSC_LINK: "x", WIN_CSC_KEY_PASSWORD: "y" }), []);
  assert.ok(missingCredentials("win", {}).includes("AZURE_CLIENT_SECRET"));
});

test("Linux packages are never labelled signed", () => {
  assert.equal(packagingPlan({ channel: "stable", platform: "linux" }).signed, false);
});

test("credential values are never written into the plan output", () => {
  const plan = packagingPlan({ channel: "stable", platform: "mac", env: mac });
  assert.ok(!JSON.stringify(plan).includes("base64"));
  const source = readFileSync(new URL("../scripts/release-plan.mjs", import.meta.url), "utf8");
  assert.ok(!/console\.log/.test(source));
});
