import { isHostedEnvironment } from "./env";

const ACTIVITY_ORIGIN = "https://brianlovin.com/api/activity";
const SOURCE = "tax-ui";

export type DownloadPlatform = "mac-arm" | "mac-intel" | "windows";

function postActivity(endpoint: "visit" | "download", body: Record<string, string>): void {
  if (!isHostedEnvironment()) return;

  try {
    void fetch(`${ACTIVITY_ORIGIN}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      signal: AbortSignal.timeout(800),
    }).catch(() => {});
  } catch {
    // fail open
  }
}

export function pingVisit(): void {
  postActivity("visit", { path: "/", source: SOURCE, title: "Tax UI" });
}

export function pingDownload(platform?: DownloadPlatform): void {
  postActivity("download", platform ? { source: SOURCE, platform } : { source: SOURCE });
}
