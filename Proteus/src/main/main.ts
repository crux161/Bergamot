import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as fs from "fs";
import * as path from "path";

let mainWindow: BrowserWindow | null = null;
const themeWatchers: fs.FSWatcher[] = [];
let pendingThemeBroadcast: NodeJS.Timeout | null = null;
let pendingThemeFilename: string | null = null;

// ── Theme IPC handlers ──

const userThemesDir = path.join(app.getPath("userData"), "themes");

// Bundled themes ship in resources/Custom-Theming (dev) or resources/ (packaged)
function getBundledThemesDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "Custom-Theming");
  }
  return path.join(__dirname, "../../resources/Custom-Theming");
}

/** Return all theme directories to search (user dir first, bundled second). */
function getThemeDirs(): string[] {
  const dirs = [userThemesDir];
  const bundled = getBundledThemesDir();
  if (fs.existsSync(bundled)) dirs.push(bundled);
  return dirs;
}

/** Find the first directory containing the given theme file. */
function resolveThemeFile(filename: string): string | null {
  for (const dir of getThemeDirs()) {
    const full = path.join(dir, filename);
    if (full.startsWith(dir) && fs.existsSync(full)) return full;
  }
  return null;
}

async function listThemeFiles(): Promise<string[]> {
  fs.mkdirSync(userThemesDir, { recursive: true });
  const seen = new Set<string>();

  for (const dir of getThemeDirs()) {
    try {
      const files = await fs.promises.readdir(dir);
      files
        .filter((file) => file.endsWith(".css"))
        .forEach((file) => seen.add(file));
    } catch {
      // directory doesn't exist or isn't readable
    }
  }

  return [...seen].sort();
}

async function broadcastThemeChange(filename: string | null): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const themes = await listThemeFiles();
  mainWindow.webContents.send("themes:changed", {
    filename,
    themes,
  });
}

function scheduleThemeBroadcast(filename: string | null): void {
  if (filename?.endsWith(".css")) {
    pendingThemeFilename = filename;
  } else if (pendingThemeFilename === null) {
    pendingThemeFilename = null;
  }

  if (pendingThemeBroadcast) {
    clearTimeout(pendingThemeBroadcast);
  }

  pendingThemeBroadcast = setTimeout(() => {
    const changedFilename = pendingThemeFilename;
    pendingThemeBroadcast = null;
    pendingThemeFilename = null;
    void broadcastThemeChange(changedFilename);
  }, 80);
}

function stopThemeWatchers(): void {
  themeWatchers.splice(0).forEach((watcher) => watcher.close());
  if (pendingThemeBroadcast) {
    clearTimeout(pendingThemeBroadcast);
    pendingThemeBroadcast = null;
  }
}

function startThemeWatchers(): void {
  stopThemeWatchers();
  fs.mkdirSync(userThemesDir, { recursive: true });

  for (const dir of getThemeDirs()) {
    try {
      const watcher = fs.watch(dir, (_eventType, filename) => {
        scheduleThemeBroadcast(typeof filename === "string" ? filename : null);
      });
      themeWatchers.push(watcher);
    } catch {
      // directory is unavailable or platform watch support failed
    }
  }
}

ipcMain.handle("themes:list", async () => {
  return listThemeFiles();
});

ipcMain.handle("themes:read", async (_event, filename: string) => {
  if (typeof filename !== "string" || /[/\\]/.test(filename) || !filename.endsWith(".css")) {
    throw new Error("Invalid theme filename");
  }
  const resolved = resolveThemeFile(filename);
  if (!resolved) throw new Error("Theme not found");
  return fs.promises.readFile(resolved, "utf-8");
});

ipcMain.handle("themes:getPath", () => userThemesDir);

ipcMain.handle("themes:openFolder", async () => {
  fs.mkdirSync(userThemesDir, { recursive: true });
  await shell.openPath(userThemesDir);
});

// ── Games IPC handlers ──

/** Return the directory where bundled games live. */
function getGamesDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "../renderer/games");
  }
  return path.join(__dirname, "../../public/games");
}

/**
 * Scan public/games/ for subdirectories containing a manifest.json.
 * Returns an array of game entries ready for the renderer's library modal.
 */
ipcMain.handle("games:list", async () => {
  const gamesDir = getGamesDir();
  const entries: Array<{
    id: string;
    name: string;
    icon: string;
    url: string;
    type: "wasm" | "iframe";
    version: string;
    description?: string;
    cover?: string;
    color?: string;
    gamepadMapping?: { buttons?: Record<number, string>; axes?: Record<number, [string, string]> };
  }> = [];

  let dirs: string[];
  try {
    dirs = await fs.promises.readdir(gamesDir);
  } catch {
    return entries;
  }

  for (const dir of dirs) {
    const manifestPath = path.join(gamesDir, dir, "manifest.json");
    try {
      const raw = await fs.promises.readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(raw);
      entries.push({
        id: manifest.id ?? dir.toLowerCase(),
        name: manifest.name ?? dir,
        icon: manifest.icon ?? "🎮",
        url: `/games/${dir}/${manifest.entry}`,
        type: manifest.type ?? "wasm",
        version: manifest.version ?? "0.0.0",
        description: manifest.description,
        cover: manifest.cover ? `/games/${dir}/${manifest.cover}` : undefined,
        color: manifest.color,
        gamepadMapping: manifest.gamepadMapping,
      });
    } catch {
      // No manifest or invalid JSON — skip this directory
    }
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 560,
    title: "Bergamot",
    icon: path.join(__dirname, "../../resources/icons/macOS/IMG_6739.icns"),
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#1E1F22", // Sumi — deepest background
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // In development, load from webpack dev server
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);
app.whenReady().then(startThemeWatchers);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopThemeWatchers();
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
