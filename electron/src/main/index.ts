import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { app, ipcMain } from "electron";
import log from "electron-log";
import { startServer, stopServer } from "./bun-server.js";
import { createWindow, getMainWindow } from "./window.js";
import {
  setupAutoUpdater,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
} from "./updater.js";

log.transports.file.level = "info";
log.info("App starting...");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_SERVER_URL = process.env.ELECTRON_DEV_URL;
const isDev = !!DEV_SERVER_URL;

async function getServerPort(): Promise<number> {
  if (isDev && DEV_SERVER_URL) {
    log.info("Dev mode: connecting to", DEV_SERVER_URL);
    const url = new URL(DEV_SERVER_URL);
    return parseInt(url.port, 10) || 3000;
  }
  return startServer();
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  log.info("Another instance is running, quitting...");
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = getMainWindow();
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      if (!app.isPackaged && process.platform === "darwin") {
        const devIconPath = path.join(
          __dirname,
          "..",
          "..",
          "assets",
          "app-icon-dev.png",
        );
        if (fs.existsSync(devIconPath)) {
          try {
            app.dock.setIcon(devIconPath);
          } catch (error) {
            log.warn("Failed to set dev dock icon:", error);
          }
        } else {
          log.warn("Dev icon not found:", devIconPath);
        }
      }

      const port = await getServerPort();
      createWindow(port);

      if (app.isPackaged) {
        setupAutoUpdater();
        setTimeout(() => checkForUpdates(), 5000);
      }
    } catch (error) {
      log.error("Failed to start app:", error);
      app.quit();
    }
  });

  app.on("activate", async () => {
    if (!getMainWindow()) {
      try {
        const port = await getServerPort();
        createWindow(port);
      } catch (error) {
        log.error("Failed to create window:", error);
      }
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    if (!isDev) {
      stopServer();
    }
  });

  ipcMain.handle("update:check", () => {
    checkForUpdates();
  });

  ipcMain.handle("update:download", () => {
    downloadUpdate();
  });

  ipcMain.handle("update:install", () => {
    installUpdate();
  });

  ipcMain.handle("app:version", () => {
    return app.getVersion();
  });
}
