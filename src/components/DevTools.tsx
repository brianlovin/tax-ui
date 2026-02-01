import { useState, useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { SetupDialogPreview } from "./SetupDialogPreview";

const DEV_DEMO_OVERRIDE_KEY = "dev-demo-override";

export function cycleDemoOverride(current: boolean | null): boolean | null {
  if (current === null) return true;
  if (current === true) return false;
  return null;
}

function getDemoOverrideLabel(value: boolean | null): string {
  if (value === null) return "demo: auto";
  return value ? "demo: on" : "demo: off";
}

interface DevToolsProps {
  devDemoOverride: boolean | null;
  onDemoOverrideChange: (value: boolean | null) => void;
  onTriggerError: () => void;
}

export function DevTools({
  devDemoOverride,
  onDemoOverrideChange,
  onTriggerError,
}: DevToolsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleDemoToggle = useCallback(() => {
    const newValue = cycleDemoOverride(devDemoOverride);
    if (newValue === null) {
      localStorage.removeItem(DEV_DEMO_OVERRIDE_KEY);
    } else {
      localStorage.setItem(DEV_DEMO_OVERRIDE_KEY, String(newValue));
    }
    onDemoOverrideChange(newValue);
  }, [devDemoOverride, onDemoOverrideChange]);

  useHotkeys("mod+shift+period", () => setIsVisible((v) => !v), {
    preventDefault: true,
  });

  useHotkeys("shift+d", handleDemoToggle, {
    preventDefault: true,
  });

  if (!isVisible) return null;

  return (
    <>
      <div className="fixed bottom-4 left-4 z-50 flex gap-2">
        <button
          onClick={handleDemoToggle}
          className="px-2 py-1 text-xs font-mono rounded bg-(--color-bg-muted) border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text) hover:border-(--color-text-muted)"
        >
          {getDemoOverrideLabel(devDemoOverride)}
          <span className="ml-1.5 opacity-50">Shift+D</span>
        </button>
        <button
          onClick={() => setShowPreview(true)}
          className="px-2 py-1 text-xs font-mono rounded bg-(--color-bg-muted) border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text) hover:border-(--color-text-muted)"
        >
          preview states
        </button>
        <button
          onClick={onTriggerError}
          className="px-2 py-1 text-xs font-mono rounded bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 hover:border-red-500/50"
        >
          trigger error
        </button>
      </div>
      {showPreview && (
        <SetupDialogPreview onClose={() => setShowPreview(false)} />
      )}
    </>
  );
}
