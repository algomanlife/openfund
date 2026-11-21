import { cp, mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await mkdir("public/assets", { recursive: true });
const web = "../web-react/public/";
for (const name of [
  "vela-workspace.global.min.js",
  "openfund-pine-worker.min.js",
  "mark-mint.svg",
  "ubuntu-400.ttf",
  "ubuntu-700.ttf",
  "Ubuntu-LICENSE.txt",
])
  await copyFile(web + "assets/" + name, "public/assets/" + name);
await cp(web + "assets/notices", "public/assets/notices", { recursive: true });
/* Dastkhat variable font with its OFL text, notices and pinned SOURCE.json. */
await cp(web + "assets/fonts/dastkhat", "public/assets/fonts/dastkhat", { recursive: true });
for (const [from, to] of [
  ["../../packages/openfund-charts/src/vela-bridge.js", "vela-bridge.js"],
  [
    "../../packages/openfund-gains-adapter/src/gains-adapter.js",
    "gains-adapter.js",
  ],
  ["../web-react/public/legacy/position-sizing.js", "position-sizing.js"],
  ["../web-react/public/legacy/position-overlay.js", "position-overlay.js"],
])
  await copyFile(from, "public/" + to);
let sha = "uncommitted";
try {
  sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch {}
/* package.json is the single authoritative desktop version. The channel is
   chosen by scripts/package.mjs; only beta/stable builds (which refuse to
   package without signing credentials) are marked signed. */
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const channel = ["internal", "beta", "stable"].includes(process.env.OPEN_TRADE_CHANNEL)
  ? process.env.OPEN_TRADE_CHANNEL
  : "internal";
await writeFile(
  "public/build.json",
  /* Linux packages have no OS-verified signature (SHA-256 only). */
  JSON.stringify({ version, sha, channel, signed: channel !== "internal" && process.platform !== "linux" }),
);

import { Resvg } from "@resvg/resvg-js";
await mkdir("build", { recursive: true });
const svg = await readFile(web + "assets/mark-mint.svg", "utf8");
await writeFile(
  "build/icon.png",
  new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" rx="210" fill="#151518"/><image x="128" y="128" width="768" height="768" href="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"/></svg>`,
  )
    .render()
    .asPng(),
);
await copyFile(
  "node_modules/@walletconnect/ethereum-provider/LICENSE.md",
  "public/assets/notices/WalletConnect-LICENSE.md",
);
