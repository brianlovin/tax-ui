import electronUpdater, { type UpdateInfo, type ProgressInfo } from "electron-updater";
import log from "electron-log";
import { getMainWindow } from "./window.js";

const { autoUpdater } = electronUpdater;

export function setupAutoUpdater(): void {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;

  autoUpdater.on("checking-for-update", () => {
    log.info("Checking for updates...");
    sendToRenderer("update:checking");
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    log.info("Update available:", info.version);
    sendToRenderer("update:available", { version: info.version });
  });

  autoUpdater.on("update-not-available", () => {
    log.info("No updates available");
    sendToRenderer("update:not-available");
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    log.info(`Download progress: ${progress.percent.toFixed(1)}%`);
    sendToRenderer("update:progress", { percent: progress.percent });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    log.info("Update downloaded:", info.version);
    sendToRenderer("update:downloaded", { version: info.version });
  });

  autoUpdater.on("error", (error: Error) => {
    log.error("Update error:", error);
    sendToRenderer("update:error", { message: error.message });
  });
}

function sendToRenderer(channel: string, data?: unknown): void {
  const window = getMainWindow();
  if (window) {
    window.webContents.send(channel, data);
  }
}

export function checkForUpdates(): void {
  autoUpdater.checkForUpdates();
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}
