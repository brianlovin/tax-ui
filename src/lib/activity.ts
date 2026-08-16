import { isHostedEnvironment } from "./env";

export type DownloadPlatform = "mac-arm" | "mac-intel" | "windows";

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
  postActivity("visit");
}

export function pingDownload(platform?: DownloadPlatform): void {
  postActivity("download", platform);
}
