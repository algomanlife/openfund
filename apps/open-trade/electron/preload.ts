import { contextBridge, ipcRenderer } from "electron";
const call = (channel: string, value?: unknown) =>
  ipcRenderer.invoke(channel, value);
contextBridge.exposeInMainWorld(
  "desktop",
  Object.freeze({
    config: () => call("config"),
    regions: () => call("regions"),
    selectRegion: (region: string) => call("select-region", region),
    request: (v: unknown) => call("request", v),
    connectivity: () => call("connectivity"),
    stream: (account: string | null) => call("stream", account),
    captureChart: (rect: unknown) => call("capture-chart", rect),
    copyChart: (png: string) => call("copy-chart", png),
    saveChart: (png: string) => call("save-chart", png),
    external: (target: string) => call("external", target),
    onState: (fn: (v: unknown) => void) => {
      const handler = (_e: unknown, v: unknown) => fn(v);
      ipcRenderer.on("state", handler);
      return () => ipcRenderer.removeListener("state", handler);
    },
  }),
);
