/**
 * Web bridge — provides the same `window.bergamot` API that the Electron
 * preload script exposes, but backed by plain HTTP fetch against static
 * assets served alongside the web build.
 *
 * Theme CSS files are expected at `/themes/<filename>`
 * Theme manifest at `/themes/manifest.json` (string[])
 * Game manifest at `/games/manifest.json` (GameEntry[])
 */

interface GameEntry {
  id: string;
  name: string;
  icon: string;
  url: string;
  type: "wasm" | "iframe";
  version: string;
  description?: string;
  cover?: string;
  color?: string;
  gamepadMapping?: {
    buttons?: Record<number, string>;
    axes?: Record<number, [string, string]>;
  };
}

let cachedThemeList: string[] | null = null;

export function installWebBridge(): void {
  if (typeof window.bergamot !== "undefined") return;

  (window as any).bergamot = {
    platform: "web",
    versions: {
      electron: "N/A",
      node: "N/A",
      chrome: navigator.userAgent.match(/Chrome\/(\S+)/)?.[1] ?? "unknown",
    },

    getAvailableThemes: async (): Promise<string[]> => {
      if (cachedThemeList) return cachedThemeList;
      try {
        const resp = await fetch("/themes/manifest.json");
        if (!resp.ok) return [];
        cachedThemeList = await resp.json();
        return cachedThemeList!;
      } catch {
        return [];
      }
    },

    getThemeCss: async (filename: string): Promise<string> => {
      const resp = await fetch(`/themes/${encodeURIComponent(filename)}`);
      if (!resp.ok) throw new Error(`Theme "${filename}" not found`);
      return resp.text();
    },

    getThemesPath: async (): Promise<string> => "/themes",

    openThemesFolder: async (): Promise<void> => {
      // No-op on web — there is no local folder to open.
    },

    onThemesChanged: (): (() => void) => {
      // Static deployment — themes don't change at runtime on web.
      return () => {};
    },

    listGames: async (): Promise<GameEntry[]> => {
      try {
        const resp = await fetch("/games/manifest.json");
        if (!resp.ok) return [];
        return resp.json();
      } catch {
        return [];
      }
    },
  };
}

export function isWebPlatform(): boolean {
  return typeof window.bergamot !== "undefined"
    && (window.bergamot as any).platform === "web";
}
