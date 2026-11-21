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
/* Brand artwork (0.0.4): the app icon, the macOS DMG window and the Windows
   installer pages are rendered from the SVG templates in branding/ with the
   Openfund mark (brand/logos/mark-mint.svg via web-react) and the package
   version filled in. Fonts are the bundled Ubuntu files, never system fonts,
   so every runner renders the same pixels. */
await mkdir("build", { recursive: true });
const markPath = (await readFile(web + "assets/mark-mint.svg", "utf8")).match(/ d="([^"]+)"/)[1];
const fonts = {
  fontFiles: ["public/assets/ubuntu-400.ttf", "public/assets/ubuntu-700.ttf"],
  loadSystemFonts: false,
  defaultFontFamily: "Ubuntu",
};
async function render(name, zoom = 1) {
  const svg = (await readFile(`branding/${name}.svg`, "utf8"))
    .replaceAll("{{MARK_PATH}}", markPath)
    .replaceAll("{{VERSION}}", version);
  return new Resvg(svg, { font: fonts, fitTo: zoom === 1 ? { mode: "original" } : { mode: "zoom", value: zoom } }).render();
}
/** 24-bit bottom-up BMP (NSIS only accepts BMP for installer bitmaps). */
function bmp(image) {
  const { width, height, pixels } = image;
  const row = Math.ceil((width * 3) / 4) * 4;
  const out = Buffer.alloc(54 + row * height);
  out.write("BM", 0);
  out.writeUInt32LE(out.length, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(row * height, 34);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, a = pixels[i + 3] / 255;
      const o = 54 + (height - 1 - y) * row + x * 3;
      /* composite on white: the templates are opaque, this guards edges */
      out[o] = Math.round(pixels[i + 2] * a + 255 * (1 - a));
      out[o + 1] = Math.round(pixels[i + 1] * a + 255 * (1 - a));
      out[o + 2] = Math.round(pixels[i] * a + 255 * (1 - a));
    }
  return out;
}
await writeFile("build/icon.png", (await render("icon")).asPng());
await writeFile("build/background.png", (await render("dmg-background")).asPng());
await writeFile("build/background@2x.png", (await render("dmg-background", 2)).asPng());
await writeFile("build/installerSidebar.bmp", bmp(await render("nsis-sidebar")));
await writeFile("build/uninstallerSidebar.bmp", bmp(await render("nsis-sidebar")));
await writeFile("build/installerHeader.bmp", bmp(await render("nsis-header")));
await copyFile(
  "node_modules/@walletconnect/ethereum-provider/LICENSE.md",
  "public/assets/notices/WalletConnect-LICENSE.md",
);
