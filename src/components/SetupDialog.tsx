import { Input } from "@base-ui/react/input";
import { Tabs } from "@base-ui/react/tabs";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import type { ProviderType } from "../lib/providers/types";
import type { FileProgress, FileWithId } from "../lib/schema";
import { extractYearFromFilename } from "../lib/year-extractor";
import { Button } from "./Button";
import { CountrySelector } from "./CountrySelector";
import { Dialog } from "./Dialog";
import { FAQSection } from "./FAQSection";
import { type DisplayFile, FileUploadPreview } from "./FileUploadPreview";

interface Props {
  isOpen: boolean;
  onUpload: (files: FileWithId[], apiKey: string) => Promise<void>;
  onSaveProvider?: (config: {
    apiKey?: string;
    providerType?: string;
    baseUrl?: string;
    model?: string;
  }) => Promise<void>;
  onClose: () => void;
  isProcessing?: boolean;
  fileProgress?: FileProgress[];
  hasStoredKey?: boolean;
  providerType?: ProviderType | null;
  existingYears?: number[];
  skipOpenAnimation?: boolean;
  country: string;
  onCountryChange: (c: string) => void;
}

interface FileWithYear {
  id: string;
  file: File;
  year: number | null;
  isExtracting: boolean;
  isDuplicate: boolean;
  extractionError?: string;
}

function detectProviderFromKey(key: string): ProviderType | null {
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-")) return "openai";
  return null;
}

function providerLabel(type: ProviderType | null): string {
  switch (type) {
    case "anthropic":
      return "Anthropic";
    case "openai":
      return "OpenAI";
    case "local":
      return "Local model";
    default:
      return "";
  }
}

function storedKeyPlaceholder(type: ProviderType | null): string {
  switch (type) {
    case "openai":
      return "sk-•••••••••••••••";
    default:
      return "sk-ant-•••••••••••••••";
  }
}

export function SetupDialog({
  isOpen,
  onUpload,
  onSaveProvider,
  onClose,
  isProcessing,
  fileProgress,
  hasStoredKey,
  providerType,
  existingYears = [],
  skipOpenAnimation,
  country,
  onCountryChange,
}: Props) {
  const [apiKey, setApiKey] = useState("");
  const [files, setFiles] = useState<FileWithYear[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"cloud" | "local">("cloud");
  const [localUrl, setLocalUrl] = useState("http://localhost:11434/v1");
  const [localModel, setLocalModel] = useState("");
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const detectedProvider = detectProviderFromKey(apiKey.trim());

  useEffect(() => {
    if (!isOpen) {
      setFiles([]);
      setError(null);
    }
  }, [isOpen]);

  async function fetchModels(baseUrl: string) {
    setIsLoadingModels(true);
    try {
      const res = await fetch(`/api/models?baseUrl=${encodeURIComponent(baseUrl)}`);
      if (res.ok) {
        const data = await res.json();
        const models = (data.data ?? []).map((m: { id: string }) => m.id);
        setLocalModels(models);
        if (models.length > 0 && !localModel) {
          setLocalModel(models[0]);
        }
      } else {
        setLocalModels([]);
      }
    } catch {
      setLocalModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  }

  async function extractYearFromFile(
    file: File,
    key: string,
    localConfig?: { baseUrl: string; model: string },
  ): Promise<{ year: number | null; error?: string }> {
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      if (key) formData.append("apiKey", key);
      if (localConfig) {
        formData.append("providerType", "local");
        formData.append("baseUrl", localConfig.baseUrl);
        formData.append("model", localConfig.model);
      }
      const res = await fetch("/api/extract-year", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      return { year: data.year ?? null, error: data.error };
    } catch {
      return { year: null, error: "Year extraction failed" };
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
    const isLocalConfigured = tab === "local" && !!localUrl.trim() && !!localModel;
    const canExtract = !!key || !!hasStoredKey || isLocalConfigured;
    const localConfig = isLocalConfigured
      ? { baseUrl: localUrl.trim(), model: localModel }
      : undefined;

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
        // Try filename-based extraction first to avoid an API call
        const filenameYear = extractYearFromFilename(entry.file.name);
        const { year, error } =
          filenameYear !== null
            ? { year: filenameYear, error: undefined }
            : await extractYearFromFile(entry.file, key, localConfig);
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
              extractionError: error,
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
    if (tab === "local") {
      if (!localUrl.trim() || !localModel) {
        setError("Please select a local model");
        return;
      }
      // For local mode, we save config via the key endpoint then proceed
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/config/key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerType: "local", baseUrl: localUrl, model: localModel }),
        });
        if (!res.ok) {
          const { error: err } = await res.json();
          throw new Error(err || `HTTP ${res.status}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to configure local model");
        setIsLoading(false);
        return;
      }
    } else {
      if (!hasStoredKey && !apiKey.trim()) {
        setError("Please enter your API key");
        return;
      }
    }
    if (files.length === 0) {
      if (!hasStoredKey) {
        setIsLoading(true);
        setError(null);
        try {
          if (tab === "cloud") {
            await onSaveProvider?.({ apiKey: apiKey.trim() });
          } else {
            await onSaveProvider?.({ providerType: "local", baseUrl: localUrl, model: localModel });
          }
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to save configuration");
        } finally {
          setIsLoading(false);
        }
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onUpload(
        files.map((f) => ({ id: f.id, file: f.file })),
        tab === "local" ? "" : apiKey.trim(),
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
          extractionError: f.extractionError,
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
    if (isLoading) return files.length > 0 ? "Processing..." : "Saving...";
    if (isExtracting) return "Checking...";
    if (files.length === 0 && !hasStoredKey) return "Save";
    if (duplicateCount > 0 && nonDuplicateCount === 0) return "Reprocess";
    return "Process";
  }

  const hasValidKey = tab === "local" ? !!localModel : hasStoredKey || !!apiKey.trim();

  const isSubmitDisabled =
    isLoading ||
    isProcessing ||
    isExtracting ||
    !hasValidKey ||
    (hasStoredKey && files.length === 0);

  const isInteractionDisabled = isLoading || isProcessing;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={hasStoredKey ? "Upload tax returns" : "Tax UI"}
      description={hasStoredKey ? "Upload more tax returns" : "Make sense of your tax returns"}
      size="lg"
      fullScreenMobile
      showClose={!isProcessing}
      closeDisabled={isProcessing}
      skipOpenAnimation={skipOpenAnimation}
      footer={<FAQSection />}
    >
      <div>
        {/* Provider Section */}
        <div className="mb-6">
          {hasStoredKey ? (
            <>
              <label className="mb-2 block text-sm font-medium">API Key</label>
              <div className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2.5 text-sm text-(--color-text-muted)">
                <span className="mr-2 inline-block rounded bg-(--color-bg) px-1.5 py-0.5 text-xs font-medium">
                  {providerLabel(providerType ?? null)}
                </span>
                {storedKeyPlaceholder(providerType ?? null)}
              </div>
            </>
          ) : (
            <Tabs.Root value={tab} onValueChange={(val) => setTab(val as "cloud" | "local")}>
              <Tabs.List className="mb-3 flex gap-1 rounded-lg bg-(--color-bg-muted) p-1">
                <Tabs.Tab
                  value="cloud"
                  className="flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-(--color-text-muted) transition-colors aria-selected:bg-(--color-bg) aria-selected:text-(--color-text) aria-selected:shadow-sm"
                >
                  Cloud API
                </Tabs.Tab>
                <Tabs.Tab
                  value="local"
                  className="flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-(--color-text-muted) transition-colors aria-selected:bg-(--color-bg) aria-selected:text-(--color-text) aria-selected:shadow-sm"
                >
                  Local Model
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="cloud">
                <label className="mb-2 block text-sm font-medium">API Key</label>
                <Input
                  autoFocus
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-... or sk-..."
                  disabled={isInteractionDisabled}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2.5 text-sm placeholder:text-(--color-text-muted) focus:border-(--color-text-muted) focus:outline-none disabled:opacity-50"
                />
                {detectedProvider && (
                  <p className="mt-1.5 text-xs text-(--color-text-muted)">
                    Detected: <span className="font-medium">{providerLabel(detectedProvider)}</span>
                  </p>
                )}
                <p className="mt-2 text-xs text-(--color-text-muted)">
                  Get your API key from{" "}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-(--color-text)"
                  >
                    console.anthropic.com
                  </a>{" "}
                  or{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-(--color-text)"
                  >
                    platform.openai.com
                  </a>
                </p>
              </Tabs.Panel>

              <Tabs.Panel value="local">
                <label className="mb-2 block text-sm font-medium">Server URL</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={localUrl}
                    onChange={(e) => setLocalUrl(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    disabled={isInteractionDisabled}
                    className="flex-1 rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2.5 text-sm placeholder:text-(--color-text-muted) focus:border-(--color-text-muted) focus:outline-none disabled:opacity-50"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fetchModels(localUrl)}
                    disabled={isInteractionDisabled || isLoadingModels}
                  >
                    {isLoadingModels ? "Loading..." : "Connect"}
                  </Button>
                </div>

                {localModels.length > 0 && (
                  <div className="mt-3">
                    <label className="mb-2 block text-sm font-medium">Model</label>
                    <select
                      value={localModel}
                      onChange={(e) => setLocalModel(e.target.value)}
                      disabled={isInteractionDisabled}
                      className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2.5 text-sm focus:border-(--color-text-muted) focus:outline-none disabled:opacity-50"
                    >
                      {localModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <p className="mt-2 text-xs text-(--color-text-muted)">
                  Requires{" "}
                  <a
                    href="https://ollama.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-(--color-text)"
                  >
                    Ollama
                  </a>{" "}
                  or any OpenAI-compatible local server
                </p>
              </Tabs.Panel>
            </Tabs.Root>
          )}
        </div>

        {/* Country Section */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium">Country</label>
          <div className="flex items-center">
            <CountrySelector country={country} onChange={onCountryChange} />
          </div>
        </div>

        {/* Upload Section - always visible, disabled during processing */}
        <div className="mb-6">
          <label className="sr-only mb-2 block text-sm font-medium">Files</label>

          {/* Drop zone */}
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
              <p className="text-sm">Drop your tax return PDFs here</p>
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
              className="mb-4 overflow-hidden text-sm text-(--color-negative)"
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
