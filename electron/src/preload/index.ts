import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

type IpcHandler<T = void> = (event: IpcRendererEvent, data: T) => void;

const electronAPI = {
  isElectron: true,
  platform: process.platform,
  version: () => ipcRenderer.invoke("app:version") as Promise<string>,

  update: {
    check: () => ipcRenderer.invoke("update:check"),
    download: () => ipcRenderer.invoke("update:download"),
    install: () => ipcRenderer.invoke("update:install"),

    onAvailable: (callback: (data: { version: string }) => void) => {
      const handler: IpcHandler<{ version: string }> = (_, data) => callback(data);
      ipcRenderer.on("update:available", handler);
      return () => ipcRenderer.removeListener("update:available", handler);
    },
    onProgress: (callback: (data: { percent: number }) => void) => {
      const handler: IpcHandler<{ percent: number }> = (_, data) => callback(data);
      ipcRenderer.on("update:progress", handler);
      return () => ipcRenderer.removeListener("update:progress", handler);
    },
    onDownloaded: (callback: (data: { version: string }) => void) => {
      const handler: IpcHandler<{ version: string }> = (_, data) => callback(data);
      ipcRenderer.on("update:downloaded", handler);
      return () => ipcRenderer.removeListener("update:downloaded", handler);
    },
    onError: (callback: (data: { message: string }) => void) => {
      const handler: IpcHandler<{ message: string }> = (_, data) => callback(data);
      ipcRenderer.on("update:error", handler);
      return () => ipcRenderer.removeListener("update:error", handler);
    },
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
