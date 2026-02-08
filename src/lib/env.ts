import { isElectron } from "./electron";

const DEV_DEMO_OVERRIDE_KEY = "dev-demo-override";

export function getHost(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.hostname;
}

export function isLocalhostHost(host: string | null): boolean {
  if (!host) return false;
  return host === "localhost" || host === "127.0.0.1";
}

export function isHostedEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  if (isElectron()) return false;
  return !isLocalhostHost(getHost());
}

export function getDevDemoOverride(): boolean | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(DEV_DEMO_OVERRIDE_KEY);
  return stored === null ? null : stored === "true";
}

export function setDevDemoOverride(value: boolean | null): void {
  if (typeof window === "undefined") return;
  if (value === null) {
    localStorage.removeItem(DEV_DEMO_OVERRIDE_KEY);
  } else {
    localStorage.setItem(DEV_DEMO_OVERRIDE_KEY, String(value));
  }
}

export function resolveDemoMode(
  override: boolean | null,
  serverIsDemo: boolean,
): boolean {
  if (override !== null) return override;
  if (isElectron()) return false;
  if (serverIsDemo) return true;
  return isHostedEnvironment();
}
