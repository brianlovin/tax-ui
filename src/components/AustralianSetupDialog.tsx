import { Input } from "@base-ui/react/input";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  AUSTRALIAN_STATES,
  type AustralianState,
  getPostcodeData,
  isValidAustralianPostcode,
} from "../data/postcodes";
import type { FileProgress, FileWithId } from "../lib/schema";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { type DisplayFile, FileUploadPreview } from "./FileUploadPreview";

interface Props {
  isOpen: boolean;
  onUpload: (
    files: FileWithId[],
    apiKey: string,
    location: {
      postcode: string;
      suburb: string;
      state: AustralianState;
    },
  ) => Promise<void>;
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

export function AustralianSetupDialog({
  isOpen,
  onUpload,
  onClose,
  isProcessing,
  fileProgress,
  hasStoredKey,
  existingYears = [],
  skipOpenAnimation,
}: Props) {
  // API Key state
  const [apiKey, setApiKey] = useState("");

  // Location state
  const [postcode, setPostcode] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setStateValue] = useState<AustralianState | "">("");
  const [availableSuburbs, setAvailableSuburbs] = useState<string[]>([]);

  // File upload state
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

  // Auto-fill suburb and state when postcode is entered
  useEffect(() => {
    if (postcode.length === 4 && isValidAustralianPostcode(postcode)) {
      const data = getPostcodeData(postcode);
      if (data) {
        setAvailableSuburbs(data.suburbs);
        setStateValue(data.state as AustralianState);
        // Auto-select first suburb if only one available
        if (data.suburbs.length === 1 && data.suburbs[0]) {
          setSuburb(data.suburbs[0]);
        } else if (!data.suburbs.includes(suburb)) {
          setSuburb("");
        }
      } else {
        setAvailableSuburbs([]);
        setStateValue("");
        setSuburb("");
      }
    } else {
      setAvailableSuburbs([]);
    }
  }, [postcode, suburb]);

  async function extractYearFromFile(file: File, key: string): Promise<number | null> {
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
            isDuplicate: f.year !== null ? checkDuplicate(f.year, i, updated) : false,
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
    setError(null);

    // Validation
    if (!hasStoredKey && !apiKey.trim()) {
      setError("Please enter your OpenAI-compatible API key");
      return;
    }

    if (!postcode || !suburb || !state) {
      setError("Please fill in your location details");
      return;
    }

    if (!isValidAustralianPostcode(postcode)) {
      setError("Please enter a valid 4-digit Australian postcode");
      return;
    }

    if (files.length === 0) {
      setError("Please upload at least one tax return PDF");
      return;
    }

    setIsLoading(true);

    try {
      await onUpload(
        files.map((f) => ({ id: f.id, file: f.file })),
        apiKey.trim(),
        { postcode, suburb, state: state as AustralianState },
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

  const processingCount = fileProgress?.filter((f) => f.status === "parsing").length ?? 0;
  const completedCount = fileProgress?.filter((f) => f.status === "complete").length ?? 0;
  const totalCount = fileProgress?.length ?? 0;
  const currentIndex = completedCount + processingCount;

  function getButtonText(): string {
    if (isProcessing) return `Processing ${currentIndex} of ${totalCount}...`;
    if (isLoading) return "Processing...";
    if (isExtracting) return "Checking...";
    if (duplicateCount > 0 && nonDuplicateCount === 0) return "Reprocess";
    return "Process Tax Returns";
  }

  const isSubmitDisabled =
    isLoading ||
    isProcessing ||
    isExtracting ||
    (!hasStoredKey && !apiKey.trim()) ||
    !postcode ||
    !suburb ||
    !state ||
    files.length === 0;

  const isInteractionDisabled = isLoading || isProcessing;
  const isSuburbDisabled = availableSuburbs.length === 0;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={hasStoredKey ? "Upload Tax Returns" : "Australian Pennywise"}
      description={
        hasStoredKey
          ? "Upload more Australian tax return PDFs"
          : "Make sense of your Australian tax returns"
      }
      size="lg"
      fullScreenMobile
      showClose={!isProcessing}
      closeDisabled={isProcessing}
      skipOpenAnimation={skipOpenAnimation}
    >
      <div className="space-y-6">
        {/* Location Section */}
        <div className="rounded-xl border border-(--color-border) p-4">
          <h3 className="mb-4 text-sm font-semibold">Your Location</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Postcode */}
            <div>
              <label htmlFor="postcode" className="mb-2 block text-sm font-medium">
                Postcode
              </label>
              <Input
                id="postcode"
                type="text"
                value={postcode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPostcode(value);
                }}
                placeholder="e.g. 2000"
                maxLength={4}
                autoComplete="postal-code"
                disabled={isInteractionDisabled}
                className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2.5 text-sm placeholder:text-(--color-text-muted) focus:border-(--color-text-muted) focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* Suburb */}
            <div>
              <label htmlFor="suburb" className="mb-2 block text-sm font-medium">
                Suburb
              </label>
              {availableSuburbs.length > 1 ? (
                <select
                  id="suburb"
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  disabled={isInteractionDisabled}
                  className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2.5 text-sm focus:border-(--color-text-muted) focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select...</option>
                  {availableSuburbs.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="suburb"
                  type="text"
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  placeholder={isSuburbDisabled ? "Enter postcode..." : "Suburb"}
                  disabled={isInteractionDisabled || isSuburbDisabled}
                  autoComplete="address-level2"
                  className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2.5 text-sm placeholder:text-(--color-text-muted) focus:border-(--color-text-muted) focus:outline-none disabled:opacity-50"
                />
              )}
            </div>

            {/* State */}
            <div>
              <label htmlFor="state" className="mb-2 block text-sm font-medium">
                State
              </label>
              <select
                id="state"
                value={state}
                onChange={(e) => setStateValue(e.target.value as AustralianState)}
                disabled={isInteractionDisabled}
                className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2.5 text-sm focus:border-(--color-text-muted) focus:outline-none disabled:opacity-50"
              >
                <option value="">Select...</option>
                {AUSTRALIAN_STATES.map((s: AustralianState) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* API Key Section */}
        <div>
          <label className="mb-2 block text-sm font-medium">OpenAI-compatible API Key</label>
          {hasStoredKey ? (
            <div className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2.5 text-sm text-(--color-text-muted)">
              sk-•••••••••••••••
            </div>
          ) : (
            <>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                disabled={isInteractionDisabled}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2.5 text-sm placeholder:text-(--color-text-muted) focus:border-(--color-text-muted) focus:outline-none disabled:opacity-50"
              />
              <p className="mt-2 text-xs text-(--color-text-muted)">
                Get your API key from{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-(--color-text)"
                >
                  OpenAI
                </a>
                ,{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-(--color-text)"
                >
                  Anthropic
                </a>
                , or any OpenAI-compatible provider
              </p>
            </>
          )}
        </div>

        {/* Upload Section */}
        <div>
          <label className="sr-only mb-2 block text-sm font-medium">Files</label>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isInteractionDisabled && fileInputRef.current?.click()}
            className={[
              "rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200",
              isDragging
                ? "border-(--color-text-muted) bg-(--color-bg-muted)"
                : "border-(--color-border) hover:border-(--color-text-muted)",
              isInteractionDisabled
                ? "pointer-events-none cursor-not-allowed opacity-50"
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
              <p className="text-sm">Drop your Australian tax return PDFs here</p>
              <p className="mt-1 text-xs opacity-70">Click to browse</p>
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
              className="overflow-hidden text-sm text-(--color-negative)"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit button */}
        <Button onClick={handleSubmit} disabled={isSubmitDisabled} className="w-full">
          {getButtonText()}
        </Button>
      </div>
    </Dialog>
  );
}
