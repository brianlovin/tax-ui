import { isHostedEnvironment } from "./env";

export type DownloadPlatform = "mac-arm" | "mac-intel" | "windows";

const VISIT_STORAGE_PREFIX = "tax-ui:visit:";
const claimedVisitPaths = new Set<string>();

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

function visitStorageKey(path: string): string {
  return `${VISIT_STORAGE_PREFIX}${path}`;
}

/** First claim for a path in this page load / tab wins. Later calls are no-ops. */
export function claimVisitPing(path: string = currentPath()): boolean {
  if (claimedVisitPaths.has(path)) return false;

  try {
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem(visitStorageKey(path))) {
        claimedVisitPaths.add(path);
        return false;
      }
      sessionStorage.setItem(visitStorageKey(path), "1");
    }
  } catch {
    // sessionStorage unavailable — in-memory claim still applies
  }

  claimedVisitPaths.add(path);
  return true;
}

function postActivity(type: "visit" | "download", platform?: DownloadPlatform): void {
  if (!isHostedEnvironment()) return;

  try {
    void fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(platform ? { type, platform } : { type }),
      keepalive: true,
      signal: AbortSignal.timeout(800),
    }).catch(() => {});
  } catch {
    // fail open
  }
}

export function pingVisit(): void {
  if (!claimVisitPing()) return;
  postActivity("visit");
}

export function pingDownload(platform?: DownloadPlatform): void {
  postActivity("download", platform);
}
