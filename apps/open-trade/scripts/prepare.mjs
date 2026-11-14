import { cp, mkdir, copyFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await mkdir("public/assets", { recursive: true });
const web = "../web-react/public/";
for (const name of [
  "vela-workspace.global.min.js",
  "openfund-pine-worker.min.js",
  "mark-mint.svg",
  "ubuntu-400.ttf",
  "ubuntu-700.ttf",
  "Vazirmatn.ttf",
  "Ubuntu-LICENSE.txt",
  "Vazirmatn-LICENSE.txt",
])
  await copyFile(web + "assets/" + name, "public/assets/" + name);
await cp(web + "assets/notices", "public/assets/notices", { recursive: true });
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
await writeFile(
  "public/build.json",
  JSON.stringify({ version: "0.0.1", sha, channel: "beta", signed: false }),
);

import { Resvg } from "@resvg/resvg-js";
import { readFile } from "node:fs/promises";
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
