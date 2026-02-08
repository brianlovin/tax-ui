import path from "path";
import { fileURLToPath } from "url";
import { BrowserWindow, shell, type Event, type HandlerDetails } from "electron";
import Store from "electron-store";
import log from "electron-log";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

interface StoreSchema {
  windowBounds: WindowBounds;
}

const store = new Store<StoreSchema>();

let mainWindow: BrowserWindow | null = null;

export function createWindow(port: number): BrowserWindow {
  const bounds = store.get("windowBounds", {
    width: 1200,
    height: 800,
    x: undefined,
    y: undefined,
  });

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 600,
    title: "Tax UI",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
    backgroundColor: "#0a0a0a",
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set("windowBounds", bounds);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }: HandlerDetails) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event: Event, url: string) => {
    const serverUrl = `http://localhost:${port}`;
    if (!url.startsWith(serverUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const serverUrl = `http://localhost:${port}`;
  log.info("Loading URL:", serverUrl);
  mainWindow.loadURL(serverUrl);

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
