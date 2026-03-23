import { contextBridge, ipcRenderer } from "electron";

interface TurtleSearchResult {
  id: string;
  title: string;
  img: string;
}

interface TurtleEpisode {
  epNum: number;
  link: string;
}

interface TurtleSubtitle {
  lang: string;
  url: string;
}

interface TurtleStreamSource {
  server: string;
  url: string;
  subs?: TurtleSubtitle[];
}

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

  // Screen share picker
  onScreenShareRequested: (
    listener: (sources: Array<{
      id: string;
      name: string;
      thumbnail: string;
      appIcon: string | null;
      display_id: string;
    }>) => void,
  ) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      sources: Array<{
        id: string;
        name: string;
        thumbnail: string;
        appIcon: string | null;
        display_id: string;
      }>,
    ) => {
      listener(sources);
    };
    ipcRenderer.on("screen-share:sources", wrapped);
    return () => ipcRenderer.removeListener("screen-share:sources", wrapped);
  },
  resolveScreenShare: (sourceId: string | null) => {
    ipcRenderer.send("screen-share:select", sourceId);
  },
});

contextBridge.exposeInMainWorld("api", {
  scraper: {
    search: (query: string): Promise<TurtleSearchResult[]> => ipcRenderer.invoke("scraper:search", query),
    getEpisodes: (showId: string): Promise<TurtleEpisode[]> => ipcRenderer.invoke("scraper:getEpisodes", showId),
    extractStreamUrl: (episodeLink: string): Promise<TurtleStreamSource[]> =>
      ipcRenderer.invoke("scraper:extractStreamUrl", episodeLink),
  },
});
