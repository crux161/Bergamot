import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as fs from "fs";
import * as path from "path";

let mainWindow: BrowserWindow | null = null;

// ── Theme IPC handlers ──

const themesDir = path.join(app.getPath("userData"), "themes");

ipcMain.handle("themes:list", async () => {
  fs.mkdirSync(themesDir, { recursive: true });
  const files = await fs.promises.readdir(themesDir);
  return files.filter((f) => f.endsWith(".css"));
});

ipcMain.handle("themes:read", async (_event, filename: string) => {
  if (typeof filename !== "string" || /[/\\]/.test(filename) || !filename.endsWith(".css")) {
    throw new Error("Invalid theme filename");
  }
  const fullPath = path.join(themesDir, filename);
  if (!fullPath.startsWith(themesDir)) {
    throw new Error("Invalid path");
  }
  return fs.promises.readFile(fullPath, "utf-8");
});

ipcMain.handle("themes:getPath", () => themesDir);

ipcMain.handle("themes:openFolder", async () => {
  fs.mkdirSync(themesDir, { recursive: true });
  await shell.openPath(themesDir);
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
