type ElectronPlatform = "darwin" | "win32" | "linux" | string;

export function isElectron(): boolean {
  return Boolean(window?.electronAPI?.isElectron);
}

export function getElectronPlatform(): ElectronPlatform | null {
  return window?.electronAPI?.platform ?? null;
}

export function isMacElectron(): boolean {
  return isElectron() && getElectronPlatform() === "darwin";
}

export function applyElectronDocumentAttributes(): void {
  if (!isElectron()) return;
  const platform = getElectronPlatform();
  const root = document.documentElement;
  root.dataset.electron = "true";
  if (platform) {
    root.dataset.platform = platform;
  }
}
