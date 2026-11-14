import {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  session,
  safeStorage,
  shell,
} from "electron";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  backendOrigin,
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
let win: BrowserWindow | null = null,
  token = "",
  origin = "",
  projectId = "",
  stop: AbortController | null = null;
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
  const data = await response
    .json()
    .catch(() => ({ error: "Invalid server response" }));
  return { ok: response.ok, status: response.status, data, error: data.error };
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
    origin = bundled.origin ? backendOrigin(bundled.origin) : "";
    projectId = bundled.projectId || "";
  } catch {}
  try {
    const saved = JSON.parse(await readFile(configPath(), "utf8"));
    origin = saved.origin ? backendOrigin(saved.origin) : "";
    projectId = String(saved.projectId || "");
    bounds = {
      width: Math.max(960, Math.min(3000, Number(saved.width) || 1440)),
      height: Math.max(640, Math.min(2000, Number(saved.height) || 960)),
    };
  } catch {}
  if (process.env.OPEN_TRADE_BACKEND)
    origin = backendOrigin(process.env.OPEN_TRADE_BACKEND);
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
    title: "Open Trade",
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
    secureStorage: encrypted(),
    version: app.getVersion(),
  }));
  handle("configure", async (v) => {
    const next = backendOrigin(v.origin);
    if (!/^[a-f0-9]{32}$/i.test(v.projectId || "") && v.projectId !== "")
      throw new Error("Invalid WalletConnect project ID");
    await clearToken();
    origin = next;
    projectId = v.projectId;
    await writeFile(
      configPath(),
      JSON.stringify({ origin, projectId, ...bounds }),
      { mode: 0o600 },
    );
    return true;
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
  handle("external", (target) => {
    const links: Record<string, string> = {
      vela: "https://github.com/LuxAlgo/Vela",
      source:
        "https://github.com/algomanlife/openfund/tree/feature/open-trade-desktop",
    };
    if (!links[target]) throw new Error("Unsupported link");
    return shell.openExternal(links[target]);
  });
  win.on("close", () => {
    if (win && !win.isMaximized()) bounds = win.getBounds();
    void writeFile(
      configPath(),
      JSON.stringify({
        origin,
        projectId,
        width: bounds.width,
        height: bounds.height,
      }),
      { mode: 0o600 },
    );
  });
  win.once("ready-to-show", () => win?.show());
  await win.loadURL("open-trade://app/index.html");
});
