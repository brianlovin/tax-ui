import { Collapsible } from "@base-ui/react/collapsible";
import { useEffect, useState } from "react";

import appIconUrl from "../app-icon.png";
import { detectPlatform, getPlatformLabel } from "../lib/platform";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { FAQSection } from "./FAQSection";

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface ReleaseInfo {
  version: string;
  assets: ReleaseAsset[];
}

// Start fetching immediately on module load so data is ready before the dialog opens
const releasePromise: Promise<ReleaseInfo> = fetch(
  "https://api.github.com/repos/brianlovin/tax-ui/releases/latest",
)
  .then((res) => {
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  })
  .then((data) => ({
    version: (data.tag_name as string).replace(/^v/, ""),
    assets: data.assets as ReleaseAsset[],
  }));

function useLatestRelease() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    releasePromise.then(setRelease).catch(() => setError(true));
  }, []);

  return { release, error };
}

function getDownloadUrl(
  assets: ReleaseAsset[],
  type: "mac-arm" | "mac-intel" | "windows",
): string | null {
  for (const asset of assets) {
    const name = asset.name.toLowerCase();
    if (type === "mac-arm" && name.endsWith(".dmg") && name.includes("arm64")) {
      return asset.browser_download_url;
    }
    if (type === "mac-intel" && name.endsWith(".dmg") && !name.includes("arm64")) {
      return asset.browser_download_url;
    }
    if (type === "windows" && name.endsWith(".exe")) {
      return asset.browser_download_url;
    }
  }
  return null;
}

const RELEASES_URL = "https://github.com/brianlovin/tax-ui/releases/latest";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  skipOpenAnimation?: boolean;
}

export function DemoDialog({ isOpen, onClose, skipOpenAnimation }: Props) {
  const { release, error } = useLatestRelease();
  const platform = detectPlatform();
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);

  // Determine primary download based on detected platform
  const primaryPlatform =
    platform === "windows" ? "windows" : platform === "mac-intel" ? "mac-intel" : "mac-arm";
  const primaryUrl = release && !error ? getDownloadUrl(release.assets, primaryPlatform) : null;
  const primaryLabel = `Download for ${getPlatformLabel(primaryPlatform)}`;

  // Alternate platforms
  type AltPlatform = { label: string; url: string | null };
  const altPlatforms: AltPlatform[] = [];
  if (release && !error) {
    if (platform !== "mac-intel") {
      const url = getDownloadUrl(release.assets, "mac-intel");
      if (url) altPlatforms.push({ label: "Intel Mac", url });
    }
    if (platform === "mac-intel") {
      const url = getDownloadUrl(release.assets, "mac-arm");
      if (url) altPlatforms.push({ label: "Apple Silicon Mac", url });
    }
    if (platform !== "windows") {
      const url = getDownloadUrl(release.assets, "windows");
      if (url) altPlatforms.push({ label: "Windows", url });
    }
  }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title=""
      size="lg"
      fullScreenMobile
      autoFocusClose
      skipOpenAnimation={skipOpenAnimation}
      footer={<FAQSection />}
    >
      <div className="flex flex-col gap-6">
        {/* App icon + version */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center">
            <img src={appIconUrl} alt="Tax UI" width={80} height={80} className="rounded-2xl" />
          </div>

          <div className="flex flex-col">
            <div className="text-center text-2xl font-semibold">Tax UI</div>
            <div className="text-center text-lg font-medium text-neutral-500 dark:text-neutral-400">
              Visualize and chat with your tax returns.
            </div>
          </div>
        </div>

        {/* Primary download button */}
        <div className="flex flex-col items-center gap-3">
          {error || (release && !primaryUrl) ? (
            <Button
              nativeButton={false}
              render={<a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" />}
              className="justify-center bg-(--color-brand) text-center dark:text-white"
            >
              Download from GitHub
            </Button>
          ) : primaryUrl ? (
            <Button
              nativeButton={false}
              render={<a href={primaryUrl} />}
              className="justify-center bg-(--color-brand) text-center dark:text-white"
            >
              {primaryLabel}
            </Button>
          ) : (
            <Button disabled className="justify-center bg-(--color-brand) dark:text-white">
              Loading...
            </Button>
          )}

          {/* Alternate platform links */}
          {altPlatforms.length > 0 && (
            <p className="text-xs text-(--color-text-muted)">
              Also available for{" "}
              {altPlatforms.map((alt, i) => (
                <span key={alt.label}>
                  {i > 0 && " & "}
                  <a href={alt.url!} className="underline hover:text-(--color-text)">
                    {alt.label}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>

        {/* Collapsible CLI instructions */}
        <Collapsible.Root open={collapsibleOpen} onOpenChange={setCollapsibleOpen}>
          <Collapsible.Trigger className="flex w-full cursor-pointer items-center gap-3 text-xs text-(--color-text-muted)">
            <span className="flex w-full items-center justify-center gap-1">
              Run from source
              <svg
                className="h-3 w-3 transition-transform"
                style={{ transform: collapsibleOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </span>
          </Collapsible.Trigger>
          <Collapsible.Panel className="overflow-hidden data-[ending-style]:h-0 data-[starting-style]:h-0">
            <div className="space-y-4 pt-4">
              <div className="rounded-lg bg-(--color-bg-muted) p-3 font-mono text-sm">
                <div className="text-(--color-text-muted)"># clone and run</div>
                <div>git clone https://github.com/brianlovin/tax-ui</div>
                <div>cd tax-ui</div>
                <div>bun install</div>
                <div>bun run dev</div>
              </div>
              <p className="text-xs text-(--color-text-muted)">
                Requires{" "}
                <a
                  href="https://bun.sh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-(--color-text)"
                >
                  Bun
                </a>{" "}
                and an{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-(--color-text)"
                >
                  Anthropic API key
                </a>
              </p>
            </div>
          </Collapsible.Panel>
        </Collapsible.Root>
      </div>
    </Dialog>
  );
}
