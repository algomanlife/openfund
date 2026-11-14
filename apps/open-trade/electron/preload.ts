import { contextBridge, ipcRenderer } from "electron";
const call = (channel: string, value?: unknown) =>
  ipcRenderer.invoke(channel, value);
contextBridge.exposeInMainWorld(
  "desktop",
  Object.freeze({
    config: () => call("config"),
    configure: (v: unknown) => call("configure", v),
    request: (v: unknown) => call("request", v),
    connectivity: () => call("connectivity"),
    stream: (account: string | null) => call("stream", account),
    external: (target: string) => call("external", target),
    onState: (fn: (v: unknown) => void) => {
      const handler = (_e: unknown, v: unknown) => fn(v);
      ipcRenderer.on("state", handler);
      return () => ipcRenderer.removeListener("state", handler);
    },
  }),
);
