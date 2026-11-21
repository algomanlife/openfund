import {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  session,
  safeStorage,
  shell,
  clipboard,
  ClipboardItem,
  dialog,
  nativeImage,
} from "electron";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  REGIONS,
  MAX_RESPONSE_BYTES,
  externalLink,
  newerRelease,
  parseBody,
  projectIdStatus,
  resolveBackend,
  validateRequest,
  retryDelay,
  trustedFrame,
} from "./policy.mjs";
app.setName("Open Trade");
const dataArgument = process.argv.find((arg) =>
  arg.startsWith("--user-data-dir="),
);
if (dataArgument)
  app.setPath(
    "userData",
    path.resolve(dataArgument.slice("--user-data-dir=".length)),
  );
protocol.registerSchemesAsPrivileged([
  {
    scheme: "open-trade",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
if (!app.requestSingleInstanceLock()) app.quit();
const regions = REGIONS; /* canonical regional origins (ADR 0043) */
type Region = keyof typeof regions;
let region: Region = "international";
async function probe(url: string) {
  const start = performance.now();
  try {
    const response = await fetch(url + "/health", { signal: AbortSignal.timeout(5000), redirect: "error" });
    if (response.ok && (await response.json()).ok === true) return Math.round((performance.now() - start) / 5) * 5;
  } catch {}
  return null;
}

let win: BrowserWindow | null = null,
  token = "",
  origin = "",
  projectId = "",
  stop: AbortController | null = null;
/* Single authoritative desktop version: package.json → app.getVersion();
   build.json (written by scripts/prepare.mjs) adds commit, channel, signing. */
let build: { version: string; sha: string; channel: string; signed: boolean } = {
  version: "",
  sha: "",
  channel: "development",
  signed: false,
};
const iranApproved = () => process.env.OPEN_TRADE_IRAN_APPROVED === "1";
/** Reads a response body with a hard byte limit instead of buffering it whole. */
async function readLimited(response: Response, max = MAX_RESPONSE_BYTES) {
  if (!response.body) return "";
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) {
    void response.body.cancel();
    return null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      void reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
let authGeneration = 0;
let bounds = { width: 1440, height: 960 };
const configPath = () => path.join(app.getPath("userData"), "settings.json");
const tokenPath = () => path.join(app.getPath("userData"), "session.bin");
const encrypted = () =>
  safeStorage.isEncryptionAvailable() &&
  (process.platform !== "linux" ||
    safeStorage.getSelectedStorageBackend() !== "basic_text");
async function saveToken() {
  if (token && encrypted())
    await writeFile(
      tokenPath(),
      safeStorage.encryptString(JSON.stringify({ origin, token })),
      { mode: 0o600 },
    );
  else await unlink(tokenPath()).catch(() => {});
}
async function clearToken() {
  authGeneration++;
  token = "";
  stop?.abort();
  await saveToken();
}
async function api(r: any) {
  validateRequest(r);
  const generation = authGeneration;
  if (!origin) throw new Error("Configure the Openfund backend in Settings.");
  const headers: Record<string, string> = {
    Origin: origin,
    Accept: "application/json",
  };
  if (token) headers.Cookie = `openfund_session=${token}`;
  if (r.method === "POST") headers["Content-Type"] = "application/json";
  if (r.key) headers["Idempotency-Key"] = r.key;
  let response: Response;
  try {
    response = await fetch(
      origin +
        r.path +
        (r.account ? "?account=" + encodeURIComponent(r.account) : ""),
      {
        method: r.method,
        headers,
        body: r.method === "POST" ? JSON.stringify(r.body || {}) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch {
    return {
      ok: false,
      status: 0,
      error: "Connection interrupted. Operation outcome is unknown.",
    };
  }
  if (generation !== authGeneration)
    return {
      ok: false,
      status: 409,
      error: "Session changed; response discarded",
    };
  if (r.path === "/auth/verify" && response.ok) {
    const cookie = response.headers
      .getSetCookie()
      .find((c) => c.startsWith("openfund_session="));
    const sid = cookie?.match(/^openfund_session=([A-Za-z0-9_-]{43});/i)?.[1];
    if (!sid) throw new Error("Verified session cookie missing");
    token = sid;
    await saveToken();
  }
  if (response.status === 401 || (r.path === "/auth/logout" && response.ok))
    await clearToken();
  const text = await readLimited(response).catch(() => "");
  if (generation !== authGeneration)
    return { ok: false, status: 409, error: "Session changed; response discarded" };
  const parsed = parseBody(text);
  const data: any = parsed.ok ? parsed.value : { error: parsed.error };
  return { ok: response.ok && parsed.ok, status: response.status, data, error: data.error };
}
async function connectStream(account: string | null) {
  stop?.abort();
  stop = null;
  if (!account) return;
  if (!/^[a-f0-9-]{36}$/.test(account)) throw new Error("Invalid account");
  const control = new AbortController();
  stop = control;
  let attempt = 0;
  while (!control.signal.aborted && token) {
    try {
      const response = await fetch(
        origin + "/trading/stream?account=" + account,
        {
          headers: { Cookie: `openfund_session=${token}`, Origin: origin },
          signal: control.signal,
          redirect: "error",
        },
      );
      if (response.status === 401) {
        await clearToken();
        win?.webContents.send("state", { account, status: "expired" });
        break;
      }
      if (!response.ok || !response.body) throw new Error("Stream unavailable");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!control.signal.aborted) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const result = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              void reader.cancel();
              reject(new Error("Stream stale"));
            }, 20000);
          }),
        ]).finally(() => clearTimeout(timer));
        if (result.done) break;
        buffer += decoder
          .decode(result.value, { stream: true })
          .replace(/\r\n/g, "\n");
        if (buffer.length > 2000000) throw new Error("Oversized stream");
        let i;
        while ((i = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          const data = chunk
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("\n");
          if (data) {
            const snapshot = JSON.parse(data);
            attempt = 0;
            win?.webContents.send("state", {
              account,
              status: "ready",
              snapshot,
            });
          }
        }
      }
    } catch {
      /* No request bodies, cookies or wallet signatures enter logs. */
    }
    if (control.signal.aborted) break;
    win?.webContents.send("state", { account, status: "disconnected" });
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, retryDelay(attempt++));
      function done() {
        clearTimeout(timer);
        control.signal.removeEventListener("abort", done);
        resolve();
      }
      control.signal.addEventListener("abort", done, { once: true });
    });
  }
}
app.on("second-instance", () => {
  win?.restore();
  win?.focus();
});
app.on("before-quit", () => stop?.abort());
app.on("window-all-closed", () => app.quit());
app.whenReady().then(async () => {
  app.setName("Open Trade");
  await mkdir(app.getPath("userData"), { recursive: true });
  try {
    const bundled = JSON.parse(
      await readFile(path.join(__dirname, "config.json"), "utf8"),
    );
    origin = bundled.origin
      ? resolveBackend(bundled.origin, { packaged: app.isPackaged })
      : regions.international;
    projectId = bundled.projectId || "";
  } catch {
    origin = regions.international;
  }
  try {
    const b = JSON.parse(
      await readFile(path.join(__dirname, "renderer", "build.json"), "utf8"),
    );
    build = {
      version: String(b.version || ""),
      sha: /^[0-9a-f]{40}$/.test(b.sha) ? b.sha : "",
      channel: ["internal", "beta", "stable"].includes(b.channel) ? b.channel : "development",
      signed: b.signed === true,
    };
  } catch {}
  build.version = app.getVersion();
  try {
    const saved = JSON.parse(await readFile(configPath(), "utf8"));
    region = saved.region === "iran" ? "iran" : "international";
    if (region === "iran" && !iranApproved()) region = "international";
    origin = regions[region];
    bounds = {
      width: Math.max(960, Math.min(3000, Number(saved.width) || 1440)),
      height: Math.max(640, Math.min(2000, Number(saved.height) || 960)),
    };
  } catch {}
  /* A packaged build refuses any non-canonical backend (no arbitrary
     production endpoint through the environment or the renderer). */
  if (process.env.OPEN_TRADE_BACKEND) {
    try {
      origin = resolveBackend(process.env.OPEN_TRADE_BACKEND, { packaged: app.isPackaged });
    } catch (error) {
      dialog.showErrorBox("Open Trade", String((error as Error).message));
      app.exit(1);
      return;
    }
  }
  if (process.env.OPEN_TRADE_WALLETCONNECT_PROJECT_ID)
    projectId = process.env.OPEN_TRADE_WALLETCONNECT_PROJECT_ID;
  try {
    if (encrypted()) {
      const stored = JSON.parse(
        safeStorage.decryptString(await readFile(tokenPath())),
      );
      if (stored.origin === origin && /^[A-Za-z0-9_-]{43}$/i.test(stored.token))
        token = stored.token;
    }
  } catch {}
  const renderer = path.join(__dirname, "renderer");
  protocol.handle("open-trade", async (request) => {
    const u = new URL(request.url);
    if (u.host !== "app") return new Response("", { status: 403 });
    const name = decodeURIComponent(
      u.pathname === "/" ? "/index.html" : u.pathname,
    );
    if (name.includes("\\")) return new Response("", { status: 403 });
    const file = path.resolve(renderer, "." + name);
    if (!file.startsWith(renderer + path.sep))
      return new Response("", { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.setPermissionRequestHandler(
    (_wc, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.gains.trade wss://api.gains.trade https://*.walletconnect.com wss://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.org https://*.reown.com; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-src 'none'; form-action 'none'",
        ],
      },
    }),
  );
  win = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#101012",
    title: `Open Trade ${build.version}`,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 12, y: 12 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.on("will-attach-webview", (e) => e.preventDefault());
  const handle = (channel: string, fn: (v: any) => any) =>
    ipcMain.handle(channel, (event, v) => {
      if (
        event.sender !== win?.webContents ||
        event.senderFrame !== win.webContents.mainFrame ||
        !trustedFrame(event.senderFrame.url)
      )
        throw new Error("Untrusted sender");
      return fn(v);
    });
  handle("config", () => ({
    origin,
    projectId,
    projectIdStatus: projectIdStatus(projectId),
    /* WalletConnect metadata identifies the public Openfund application; the
       Reown project allowlist must contain this origin (owner setup doc). */
    metadataUrl: regions.international,
    region,
    secureStorage: encrypted(),
    version: build.version,
    sha: build.sha,
    channel: build.channel,
    signed: build.signed,
    electron: process.versions.electron,
  }));
  let releaseCheck: { at: number; value: Promise<unknown> } | null = null;
  handle("check-updates", () => {
    if (!releaseCheck || Date.now() - releaseCheck.at > 30 * 60_000) {
      releaseCheck = {
        at: Date.now(),
        value: (async () => {
          const response = await fetch(
            "https://api.github.com/repos/algomanlife/openfund/releases?per_page=30",
            {
              headers: { Accept: "application/vnd.github+json", "User-Agent": "OpenTrade/" + build.version },
              redirect: "error",
              signal: AbortSignal.timeout(10000),
            },
          );
          if (!response.ok) throw new Error("Release information unavailable");
          const text = await readLimited(response, 2_000_000);
          if (text === null) throw new Error("Release information unavailable");
          return newerRelease(JSON.parse(text), build.version, build.channel === "internal" ? "beta" : build.channel);
        })(),
      };
      releaseCheck.value.catch(() => {
        releaseCheck = null;
      });
    }
    return releaseCheck.value;
  });
  let measurements: ReturnType<typeof measureRegions> | undefined;
  let measuredAt = 0;
  async function measureRegions() {
    const [international, iran] = await Promise.all([probe(regions.international), probe(regions.iran)]);
    return { international, iran, iranEnabled: iranApproved() };
  }
  handle("regions", () => {
    if (!measurements || Date.now() - measuredAt >= 30_000) {
      measuredAt = Date.now();
      measurements = measureRegions();
    }
    return measurements;
  });
  handle("select-region", async (value: unknown) => {
    if (value !== "international" && value !== "iran") throw new Error("Unknown server region");
    if (value === "iran" && !iranApproved()) throw new Error("Iran server is not enabled for trading");
    if (region === value && origin === regions[value]) return;
    await clearToken();
    region = value;
    origin = regions[value];
    await writeFile(configPath(), JSON.stringify({ region, ...bounds }), { mode: 0o600 });
  });
  handle("request", api);
  handle("stream", (account) => {
    void connectStream(account);
    return true;
  });
  handle("connectivity", async () => {
    if (!origin) return "unconfigured";
    try {
      const r = await fetch(origin + "/health", {
        signal: AbortSignal.timeout(7000),
        redirect: "error",
      });
      if (r.ok && (await r.json()).ok === true) return "online";
      return "unavailable";
    } catch {
      try {
        await fetch("https://api.gains.trade/v1/arbitrum/prices", {
          signal: AbortSignal.timeout(7000),
          redirect: "error",
        });
        return "unavailable";
      } catch {
        return "offline";
      }
    }
  });
  handle("capture-chart", async (rect: unknown) => {
    if (!win || !rect || typeof rect !== "object") throw new Error("Invalid chart bounds");
    const { x, y, width, height } = rect as Record<string, number>;
    const view = win.getContentBounds();
    if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 ||
        width < 1 || height < 1 || x + width > view.width || y + height > view.height)
      throw new Error("Chart is outside the visible window");
    return (await win.webContents.capturePage({ x, y, width, height })).toDataURL();
  });
  for (const action of ["copy-chart", "save-chart"] as const) {
    handle(action, async (value: unknown) => {
      if (typeof value !== "string" || !value.startsWith("data:image/png;base64,") || value.length > 32_000_000)
        throw new Error("Invalid chart image");
      const image = nativeImage.createFromDataURL(value);
      if (image.isEmpty()) throw new Error("Invalid chart image");
      if (action === "copy-chart") { await clipboard.write([new ClipboardItem({ "image/png": new Blob([new Uint8Array(image.toPNG())], { type: "image/png" }) })]); return true; }
      const result = await dialog.showSaveDialog(win!, { defaultPath: "Open Trade chart.png", filters: [{ name: "PNG image", extensions: ["png"] }] });
      if (result.canceled || !result.filePath) return false;
      await writeFile(result.filePath, image.toPNG());
      return true;
    });
  }
  handle("external", (target) =>
    shell.openExternal(externalLink(target, { sha: build.sha })),
  );
  win.on("close", () => {
    if (win && !win.isMaximized()) bounds = win.getBounds();
    void writeFile(
      configPath(),
      JSON.stringify({
        region,
        width: bounds.width,
        height: bounds.height,
      }),
      { mode: 0o600 },
    );
  });
  win.once("ready-to-show", () => win?.show());
  await win.loadURL("open-trade://app/index.html");
});
