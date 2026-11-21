/* Verifies packaged installers on the runner that built them and writes a
 * machine-readable report to artifacts/signatures-<platform>-<arch>.json.
 *   - Every platform: SHA-256 of each installer must match release/SHA256SUMS.txt
 *     and the file name must carry the package.json version.
 *   - internal channel: names must say "internal-unsigned".
 *   - macOS signed: codesign --verify --deep --strict, Developer ID authority,
 *     hardened runtime flag, stapled notarization ticket on the .app, spctl.
 *   - Windows signed: Get-AuthenticodeSignature Status = Valid with a timestamp.
 * The script reports what the tools say; it never upgrades a failure. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const channel = process.env.OPEN_TRADE_CHANNEL || "internal";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const dir = "release";
const run = (cmd, args) => {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    return { ok: false, out: String(e.stdout || "") + String(e.stderr || e.message) };
  }
};
const sums = new Map(
  (await readFile(path.join(dir, "SHA256SUMS.txt"), "utf8"))
    .trim()
    .split("\n")
    .map((l) => l.split(/\s+/))
    .map(([h, n]) => [n, h]),
);
const report = { version, channel, platform: process.platform, checkedAt: new Date().toISOString(), files: [] };
let failed = false;
for (const name of (await readdir(dir)).sort()) {
  if (!/\.(exe|dmg|AppImage|deb)$/.test(name)) continue;
  const file = path.join(dir, name);
  const sha256 = createHash("sha256").update(await readFile(file)).digest("hex");
  const entry = { file: name, sha256, checks: {} };
  entry.checks.checksum = sums.get(name) === sha256;
  entry.checks.version = name.includes(`-${version}-`);
  entry.checks.channelName = channel === "internal" ? name.includes("-internal-unsigned-") : !name.includes("unsigned");
  if (channel !== "internal" && name.endsWith(".dmg")) {
    const mount = run("hdiutil", ["attach", "-nobrowse", "-readonly", "-plist", file]);
    const point = /<string>(\/Volumes\/[^<]+)<\/string>/.exec(mount.out)?.[1];
    if (point) {
      const app = path.join(point, "Open Trade.app");
      const verify = run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);
      const detail = run("codesign", ["-dvvv", app]);
      entry.checks.codesign = verify.ok;
      entry.checks.developerId = /Authority=Developer ID Application:/.test(detail.out);
      entry.checks.hardenedRuntime = /flags=0x10000\(runtime\)|\(runtime\)/.test(detail.out);
      entry.checks.gatekeeper = run("spctl", ["--assess", "--type", "execute", "--verbose=4", app]).ok;
      /* electron-builder notarizes and staples the .app inside the DMG */
      entry.checks.notarizationStapled = run("xcrun", ["stapler", "validate", app]).ok;
      run("hdiutil", ["detach", point]);
    } else entry.checks.codesign = false;
  }
  if (channel !== "internal" && name.endsWith(".exe")) {
    const ps = run("powershell", [
      "-NoProfile",
      "-Command",
      `$s = Get-AuthenticodeSignature -LiteralPath '${file.replace(/'/g, "''")}'; "$($s.Status)|$($s.SignerCertificate.Subject)|$([bool]$s.TimeStamperCertificate)"`,
    ]);
    const [status, subject, stamped] = ps.out.trim().split("|");
    entry.checks.authenticode = status === "Valid";
    entry.checks.timestamped = stamped === "True";
    entry.signer = subject || null;
  }
  if (Object.values(entry.checks).some((v) => v !== true)) failed = true;
  report.files.push(entry);
}
if (!report.files.length) throw new Error("No installers found in release/");
await mkdir("artifacts", { recursive: true });
await writeFile(`artifacts/signatures-${process.platform}-${process.arch}.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (failed) process.exit(1);
