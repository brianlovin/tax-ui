import { useState, useRef, useEffect } from "react";
import { Input } from "@base-ui/react/input";
import { AnimatePresence, motion } from "motion/react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { FAQSection } from "./FAQSection";
import { FileUploadPreview, type DisplayFile } from "./FileUploadPreview";
import type { FileProgress, FileWithId } from "../lib/schema";

interface Props {
  isOpen: boolean;
  onUpload: (files: FileWithId[], apiKey: string) => Promise<void>;
  onClose: () => void;
  isProcessing?: boolean;
  fileProgress?: FileProgress[];
  hasStoredKey?: boolean;
  existingYears?: number[];
  skipOpenAnimation?: boolean;
}

interface FileWithYear {
  id: string;
  file: File;
  year: number | null;
  isExtracting: boolean;
  isDuplicate: boolean;
}

export function SetupDialog({
  isOpen,
  onUpload,
  onClose,
  isProcessing,
  fileProgress,
  hasStoredKey,
  existingYears = [],
  skipOpenAnimation,
}: Props) {
  const [apiKey, setApiKey] = useState("");
  const [files, setFiles] = useState<FileWithYear[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !isProcessing) {
      setFiles([]);
      setError(null);
    }
  }, [isOpen, isProcessing]);

  async function extractYearFromFile(
    file: File,
    key: string,
  ): Promise<number | null> {
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      if (key) formData.append("apiKey", key);
      const res = await fetch("/api/extract-year", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      return data.year ?? null;
    } catch {
      return null;
    }
  }

  function checkDuplicate(
    year: number | null,
    fileIndex: number,
    fileList: FileWithYear[] = files,
  ): boolean {
    if (year == null) return false;
    if (existingYears.includes(year)) return true;
    for (let i = 0; i < fileIndex; i++) {
      if (fileList[i]?.year === year) return true;
    }
    return false;
  }

  async function addFiles(newFiles: File[]) {
    const key = hasStoredKey ? "" : apiKey.trim();
    const canExtract = !!key || !!hasStoredKey;

    const newFileEntries: FileWithYear[] = newFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      year: null,
      isExtracting: canExtract,
      isDuplicate: false,
    }));

    setFiles((prev) => [...prev, ...newFileEntries]);

    if (!canExtract) return;

    await Promise.all(
      newFileEntries.map(async (entry) => {
        const year = await extractYearFromFile(entry.file, key);
        setFiles((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((f) => f.id === entry.id);
          if (idx !== -1) {
            const isDuplicate = checkDuplicate(year, idx, updated);
            updated[idx] = {
              ...updated[idx]!,
              year,
              isExtracting: false,
              isDuplicate,
            };
          }
          return updated.map((f, i) => ({
            ...f,
            isDuplicate:
              f.year !== null ? checkDuplicate(f.year, i, updated) : false,
          }));
        });
      }),
    );
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!isLoading && !isProcessing) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    if (isLoading || isProcessing) return;

    setError(null);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf",
    );
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    } else {
      setError("Please upload PDF files");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (isLoading || isProcessing) return;

    setError(null);
    const selectedFiles = Array.from(e.target.files || []).filter(
      (f) => f.type === "application/pdf",
    );
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles);
    } else if (e.target.files?.length) {
      setError("Please upload PDF files");
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleRemoveFile(id: string) {
    setFiles((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      return updated.map((f, i) => ({
        ...f,
        isDuplicate: checkDuplicate(f.year, i, updated),
      }));
    });
  }

  async function handleSubmit() {
    if (!hasStoredKey && !apiKey.trim()) {
      setError("Please enter your API key");
      return;
    }
    if (files.length === 0) {
      setError("Please upload at least one tax return PDF");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onUpload(
        files.map((f) => ({ id: f.id, file: f.file })),
        apiKey.trim(),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process PDFs");
    } finally {
      setIsLoading(false);
    }
  }

  // Build unified display list from local files + processing progress
  const displayFiles: DisplayFile[] =
    isProcessing && fileProgress
      ? fileProgress.map((fp) => ({
          id: fp.id,
          filename: fp.filename,
          year: fp.year ?? null,
          status: fp.status as DisplayFile["status"],
          isDuplicate: false,
          error: fp.error,
        }))
      : files.map((f) => ({
          id: f.id,
          filename: f.file.name,
          year: f.year,
          status: f.isExtracting ? "extracting" : "ready",
          isDuplicate: f.isDuplicate,
        }));

  const isExtracting = files.some((f) => f.isExtracting);
  const nonDuplicateCount = files.filter((f) => !f.isDuplicate).length;
  const duplicateCount = files.filter((f) => f.isDuplicate).length;

  const processingCount =
    fileProgress?.filter((f) => f.status === "parsing").length ?? 0;
  const completedCount =
    fileProgress?.filter((f) => f.status === "complete").length ?? 0;
  const totalCount = fileProgress?.length ?? 0;
  const currentIndex = completedCount + processingCount;

  function getButtonText(): string {
    if (isProcessing) return `Processing ${currentIndex} of ${totalCount}...`;
    if (isLoading) return "Processing...";
    if (isExtracting) return "Checking...";
    if (duplicateCount > 0 && nonDuplicateCount === 0) return "Reprocess";
    return "Process";
  }

  const isSubmitDisabled =
    isLoading ||
    isProcessing ||
    isExtracting ||
    (!hasStoredKey && !apiKey.trim()) ||
    files.length === 0;

  const isInteractionDisabled = isLoading || isProcessing;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={hasStoredKey ? "Upload tax returns" : "Tax UI"}
      description={
        hasStoredKey
          ? "Upload more tax returns"
          : "Make sense of your tax returns"
      }
      size="lg"
      fullScreenMobile
      showClose={hasStoredKey && !isProcessing}
      closeDisabled={!hasStoredKey || isProcessing}
      skipOpenAnimation={skipOpenAnimation}
      footer={<FAQSection />}
    >
      <div>
        {/* API Key Section - always visible */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Anthropic API Key
          </label>
          {hasStoredKey ? (
            <div className="w-full px-3 py-2.5 border border-(--color-border) bg-(--color-bg-muted) rounded-lg text-sm text-(--color-text-muted)">
              sk-ant-•••••••••••••••
            </div>
          ) : (
            <>
              <Input
                autoFocus
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                disabled={isInteractionDisabled}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                className="w-full px-3 py-2.5 border border-(--color-border) bg-(--color-bg-muted) rounded-lg text-sm placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--color-text-muted) disabled:opacity-50"
              />
              <p className="text-xs text-(--color-text-muted) mt-2">
                Get your API key from{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-(--color-text)"
                >
                  console.anthropic.com
                </a>
              </p>
            </>
          )}
        </div>

        {/* Upload Section - always visible, disabled during processing */}
        <div className="mb-6">
          <label className="block sr-only text-sm font-medium mb-2">
            Files
          </label>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() =>
              !isInteractionDisabled && fileInputRef.current?.click()
            }
            className={[
              "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200",
              isDragging
                ? "border-(--color-text-muted) bg-(--color-bg-muted)"
                : "border-(--color-border) hover:border-(--color-text-muted)",
              isInteractionDisabled
                ? "opacity-50 cursor-not-allowed pointer-events-none"
                : "cursor-pointer",
            ].join(" ")}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileSelect}
              disabled={isInteractionDisabled}
              className="hidden"
            />
            <div className="text-(--color-text-muted)">
              <p className="text-sm">Drop your tax return PDFs here</p>
              <p className="text-xs mt-1 opacity-70">Click to browse</p>
            </div>
          </div>

          <FileUploadPreview
            files={displayFiles}
            onRemove={isProcessing ? undefined : handleRemoveFile}
            disabled={isLoading}
          />
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 text-sm text-(--color-negative) overflow-hidden"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          className="w-full"
        >
          {getButtonText()}
        </Button>
      </div>
    </Dialog>
  );
}
