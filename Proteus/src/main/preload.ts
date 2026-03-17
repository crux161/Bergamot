import { contextBridge, ipcRenderer } from "electron";

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld("bergamot", {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  },

  // Theme support
  getAvailableThemes: (): Promise<string[]> => ipcRenderer.invoke("themes:list"),
  getThemeCss: (filename: string): Promise<string> => ipcRenderer.invoke("themes:read", filename),
  getThemesPath: (): Promise<string> => ipcRenderer.invoke("themes:getPath"),
  openThemesFolder: (): Promise<void> => ipcRenderer.invoke("themes:openFolder"),
  onThemesChanged: (listener: (payload: { filename: string | null; themes: string[] }) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: { filename: string | null; themes: string[] }) => {
      listener(payload);
    };
    ipcRenderer.on("themes:changed", wrapped);
    return () => ipcRenderer.removeListener("themes:changed", wrapped);
  },

  // Games
  listGames: () => ipcRenderer.invoke("games:list"),
});
