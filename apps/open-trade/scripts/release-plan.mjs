/* Pure packaging plan for Open Trade installers (tested in
 * tests/release-plan.test.mjs). It decides, from the channel and the
 * environment, which electron-builder overrides apply and refuses to produce
 * an artifact whose name or metadata would claim a signature that was not
 * made. Credentials are only checked for presence here; their values are
 * read by electron-builder / Invoke-TrustedSigning, never logged or written. */

export const CHANNELS = Object.freeze(["internal", "beta", "stable"]);

const has = (env, ...names) => names.every((n) => typeof env[n] === "string" && env[n].trim() !== "");

/** Missing credential names for a signed build on one platform. */
export function missingCredentials(platform, env) {
  if (platform === "mac") {
    const missing = [];
    if (!has(env, "CSC_LINK", "CSC_KEY_PASSWORD")) missing.push("CSC_LINK", "CSC_KEY_PASSWORD");
    const apiKey = has(env, "APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER");
    const appleId = has(env, "APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID");
    if (!apiKey && !appleId) missing.push("APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER");
    return missing;
  }
  if (platform === "win") {
    const azure =
      has(env, "AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET") &&
      has(env, "OPEN_TRADE_WIN_SIGN_ENDPOINT", "OPEN_TRADE_WIN_SIGN_ACCOUNT", "OPEN_TRADE_WIN_SIGN_PROFILE", "OPEN_TRADE_WIN_PUBLISHER");
    const certificate = has(env, "WIN_CSC_LINK", "WIN_CSC_KEY_PASSWORD") || has(env, "CSC_LINK", "CSC_KEY_PASSWORD");
    return azure || certificate
      ? []
      : ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "OPEN_TRADE_WIN_SIGN_ENDPOINT", "OPEN_TRADE_WIN_SIGN_ACCOUNT", "OPEN_TRADE_WIN_SIGN_PROFILE", "OPEN_TRADE_WIN_PUBLISHER"];
  }
  /* Linux AppImage/deb carry no OS-verified signature; integrity is SHA-256. */
  return [];
}

/** electron-builder CLI arguments for a channel on one platform. */
export function packagingPlan({ channel = "internal", platform, env = {} }) {
  if (!CHANNELS.includes(channel)) throw new Error(`Unknown channel ${channel}`);
  if (!["mac", "win", "linux"].includes(platform)) throw new Error(`Unknown platform ${platform}`);
  const args = ["--" + platform, "--publish", "never"];
  if (channel === "internal") {
    /* explicit: never sign, never notarize, name says unsigned */
    args.push(
      "-c.artifactName=Open-Trade-${version}-internal-unsigned-${os}-${arch}.${ext}",
    );
    if (platform === "mac") args.push("-c.mac.identity=null", "-c.mac.notarize=false");
    return { channel, signed: false, args, env: { CSC_IDENTITY_AUTO_DISCOVERY: "false" } };
  }
  const missing = missingCredentials(platform, env);
  if (missing.length)
    throw new Error(
      `A ${channel} ${platform} build must be signed; missing: ${missing.join(", ")}. Use OPEN_TRADE_CHANNEL=internal for an unsigned internal build.`,
    );
  const suffix = channel === "beta" ? "-beta" : "";
  args.push(`-c.artifactName=Open-Trade-\${version}${suffix}-\${os}-\${arch}.\${ext}`);
  if (platform === "mac")
    args.push(
      "-c.mac.hardenedRuntime=true",
      "-c.mac.gatekeeperAssess=false",
      "-c.mac.entitlements=build/entitlements.mac.plist",
      "-c.mac.entitlementsInherit=build/entitlements.mac.plist",
      "-c.mac.notarize=true",
    );
  if (platform === "win" && has(env, "AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET") && has(env, "OPEN_TRADE_WIN_SIGN_ENDPOINT"))
    args.push(
      `-c.win.azureSignOptions.publisherName=${env.OPEN_TRADE_WIN_PUBLISHER}`,
      `-c.win.azureSignOptions.endpoint=${env.OPEN_TRADE_WIN_SIGN_ENDPOINT}`,
      `-c.win.azureSignOptions.codeSigningAccountName=${env.OPEN_TRADE_WIN_SIGN_ACCOUNT}`,
      `-c.win.azureSignOptions.certificateProfileName=${env.OPEN_TRADE_WIN_SIGN_PROFILE}`,
    );
  return { channel, signed: platform !== "linux", args, env: {} };
}
