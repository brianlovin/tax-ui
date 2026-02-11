type Platform = "mac-arm" | "mac-intel" | "windows" | "linux" | "unknown";

export function detectPlatform(): Platform {
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    "";

  if (/Mac|Macintosh/i.test(platform)) {
    // Can't reliably distinguish ARM vs Intel from UA (Chrome on Apple Silicon
    // still reports "Intel Mac OS X"). Default to ARM since it's the majority.
    return "mac-arm";
  }
  if (/Win/i.test(platform)) return "windows";
  if (/Linux/i.test(platform)) return "linux";
  return "unknown";
}

const platformLabels: Record<Platform, string> = {
  "mac-arm": "macOS (Apple Silicon)",
  "mac-intel": "macOS (Intel)",
  windows: "Windows",
  linux: "Linux",
  unknown: "your platform",
};

export function getPlatformLabel(platform: Platform): string {
  return platformLabels[platform];
}
