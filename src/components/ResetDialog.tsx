import { useState } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onReset: () => Promise<void>;
}

export function ResetDialog({ isOpen, onClose, onReset }: Props) {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState("");

  async function handleReset() {
    setIsResetting(true);
    setError("");
    try {
      await onReset();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setIsResetting(false);
    }
  }

  function handleClose() {
    setError("");
    onClose();
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} title="Reset" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-(--color-text-muted)">
          Clear all stored data and start fresh. This will remove your API key,
          tax returns, and chat history.
        </p>
        <Button
          variant="danger-outline"
          size="sm"
          onClick={handleReset}
          disabled={isResetting}
        >
          {isResetting ? "Resetting" : "Reset data"}
        </Button>
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
    </Dialog>
  );
}
