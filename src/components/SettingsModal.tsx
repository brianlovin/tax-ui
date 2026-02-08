import { Input } from "@base-ui/react/input";
import { useState } from "react";

import { Button } from "./Button";
import { Dialog } from "./Dialog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  hasApiKey: boolean;
  onSaveApiKey: (key: string) => Promise<void>;
  onClearData: () => Promise<void>;
}

export function SettingsModal({ isOpen, onClose, hasApiKey, onSaveApiKey, onClearData }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState("");

  async function handleSaveKey() {
    if (!apiKey.trim()) return;
    setIsSaving(true);
    setError("");
    try {
      await onSaveApiKey(apiKey.trim());
      setApiKey("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClearData() {
    setIsClearing(true);
    setError("");
    try {
      await onClearData();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear data");
    } finally {
      setIsClearing(false);
    }
  }

  function handleClose() {
    setApiKey("");
    setError("");
    onClose();
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} title="Settings">
      <div className="space-y-6">
        {/* API Key Section */}
        <div>
          <label className="mb-2 block text-sm font-medium">Anthropic API Key</label>
          {hasApiKey ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-(--color-text-muted)">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
                API key configured
              </div>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter new key to update..."
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2 text-sm focus:border-(--color-text-muted) focus:outline-none"
              />
            </div>
          ) : (
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2 text-sm focus:border-(--color-text-muted) focus:outline-none"
            />
          )}
          {apiKey.trim() && (
            <Button onClick={handleSaveKey} disabled={isSaving} size="sm" className="mt-2">
              {isSaving ? "Saving..." : "Save API key"}
            </Button>
          )}
        </div>

        {/* Clear Data Section */}
        <div className="border-t border-(--color-border) pt-4">
          <label className="mb-2 block text-sm font-medium">Data Management</label>
          <Button
            variant="danger-outline"
            size="sm"
            onClick={handleClearData}
            disabled={isClearing}
          >
            {isClearing ? "Resetting" : "Reset data"}
          </Button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </Dialog>
  );
}
