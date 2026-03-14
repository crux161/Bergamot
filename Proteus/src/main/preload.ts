import { contextBridge } from "electron";

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld("bergamot", {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  },
});
