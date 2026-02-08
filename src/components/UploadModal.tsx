import { Input } from "@base-ui/react/input";
import { useEffect, useRef, useState } from "react";

import { Button } from "./Button";
import { Dialog } from "./Dialog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[], apiKey: string) => Promise<void>;
  onSaveApiKey?: (apiKey: string) => Promise<void>;
  hasStoredKey: boolean;
  pendingFiles: File[];
  configureKeyOnly?: boolean;
}

export function UploadModal({
  isOpen,
  onClose,
  onUpload,
  onSaveApiKey,
  hasStoredKey,
  pendingFiles,
  configureKeyOnly,
}: Props) {
  const [apiKey, setApiKey] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFiles = pendingFiles.length > 0 ? pendingFiles : files;
  const needsApiKey = !hasStoredKey && !apiKey.trim();
  const showFileUpload = pendingFiles.length === 0 && !configureKeyOnly;

  useEffect(() => {
    if (!isOpen) {
      setFiles([]);
      setApiKey("");
      setError(null);
    }
  }, [isOpen]);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf",
    );
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
    } else {
      setError("Please upload PDF files");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const selectedFiles = Array.from(e.target.files || []).filter(
      (f) => f.type === "application/pdf",
    );
    if (selectedFiles.length > 0) {
      setFiles((prev) => [...prev, ...selectedFiles]);
    } else if (e.target.files?.length) {
      setError("Please upload PDF files");
    }
  }

  async function handleSubmit() {
    if (configureKeyOnly) {
      if (!apiKey.trim()) {
        setError("Please enter your API key");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        await onSaveApiKey?.(apiKey.trim());
        setApiKey("");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save API key");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (needsApiKey) {
      setError("Please enter your API key");
      return;
    }
    if (activeFiles.length === 0) {
      setError("Please select at least one PDF file");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onUpload(activeFiles, apiKey.trim());
      setFiles([]);
      setApiKey("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process PDF");
    } finally {
      setIsLoading(false);
    }
  }

  function handleClose() {
    if (!isLoading) {
      setFiles([]);
      setApiKey("");
      setError(null);
      onClose();
    }
  }

  const title = configureKeyOnly
    ? "API Key"
    : pendingFiles.length > 0
      ? "Enter API Key"
      : "Upload Tax Return";

  return (
    <Dialog open={isOpen} onClose={handleClose} title={title} closeDisabled={isLoading}>
      {/* Pending files indicator */}
      {pendingFiles.length > 0 && (
        <div className="mb-4 text-sm">
          <div className="text-(--color-text-muted)">
            {pendingFiles.length} file
            {pendingFiles.length > 1 ? "s" : ""} selected
          </div>
          <div className="mt-1 text-xs text-(--color-text-muted)">
            {pendingFiles.map((f, i) => (
              <div key={i} className="truncate">
                {f.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Key input */}
      {(!hasStoredKey || configureKeyOnly) && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs text-(--color-text-muted)">
            Anthropic API Key
          </label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            disabled={isLoading}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2 text-sm placeholder:text-(--color-text-muted) focus:border-(--color-text-muted) focus:outline-none disabled:opacity-50"
          />
          <p className="mt-1.5 text-xs text-(--color-text-muted)">Saved locally to .env file</p>
        </div>
      )}

      {/* File upload area */}
      {showFileUpload && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={[
            "cursor-pointer rounded-xl border border-dashed p-6 text-center text-sm transition-colors",
            isDragging
              ? "border-(--color-text-muted) bg-(--color-bg-muted)"
              : "border-(--color-border) hover:border-(--color-text-muted)",
            isLoading ? "cursor-not-allowed opacity-50" : "",
          ].join(" ")}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileSelect}
            disabled={isLoading}
            className="hidden"
          />
          {files.length > 0 ? (
            <div>
              <div>
                {files.length} file
                {files.length > 1 ? "s" : ""} selected
              </div>
              <div className="mt-1 text-xs text-(--color-text-muted)">
                {files.map((f, i) => (
                  <div key={i} className="truncate">
                    {f.name}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-(--color-text-muted)">Drop PDF files here or click to browse</div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && <div className="mt-4 text-sm text-(--color-negative)">{error}</div>}

      {/* Privacy note */}
      {!configureKeyOnly && (
        <div className="mt-4 text-xs text-(--color-text-muted)">
          Your tax return is sent directly to Anthropic's API. Data stored locally.
        </div>
      )}

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={
          isLoading || (configureKeyOnly ? !apiKey.trim() : needsApiKey || activeFiles.length === 0)
        }
        className="mt-4 w-full"
      >
        {isLoading
          ? configureKeyOnly
            ? "Saving..."
            : "Processing..."
          : configureKeyOnly
            ? "Save API key"
            : `Parse ${activeFiles.length > 1 ? `${activeFiles.length} returns` : "tax return"}`}
      </Button>
    </Dialog>
  );
}
