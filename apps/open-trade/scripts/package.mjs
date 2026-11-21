/* Packages the already-built app (`npm run build`) for the current OS.
 *   OPEN_TRADE_CHANNEL=internal (default) → unsigned, named internal-unsigned
 *   OPEN_TRADE_CHANNEL=beta|stable        → signed (+ notarized on macOS) or fails
 * The build.json written by prepare.mjs must agree with the channel, so the
 * About dialog can never call an unsigned build signed. */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { packagingPlan } from "./release-plan.mjs";

const platform = { darwin: "mac", win32: "win", linux: "linux" }[process.platform];
const channel = process.env.OPEN_TRADE_CHANNEL || "internal";
const plan = packagingPlan({ channel, platform, env: process.env });
const build = JSON.parse(await readFile("out/renderer/build.json", "utf8"));
if (build.channel !== channel || build.signed !== plan.signed)
  throw new Error(
    `out/renderer/build.json says ${build.channel}/${build.signed ? "signed" : "unsigned"}; rebuild with OPEN_TRADE_CHANNEL=${channel}.`,
  );
console.log(`Packaging Open Trade ${build.version} (${channel}, ${plan.signed ? "signed" : "unsigned"}) for ${platform}`);
/* electron-builder's own CLI entry, run by this Node without a shell, so
   override values (publisher names, ${version} templates) are passed verbatim */
/* optional architecture flag from CI (one runner per architecture) */
const arch = process.argv.slice(2).filter((a) => ["--arm64", "--x64"].includes(a));
execFileSync(process.execPath, ["node_modules/electron-builder/cli.js", ...plan.args, ...arch], {
  stdio: "inherit",
  env: { ...process.env, ...plan.env },
});
