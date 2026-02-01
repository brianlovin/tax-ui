import { useState, useRef, useCallback, useEffect } from "react";
import { Accordion } from "@base-ui/react/accordion";
import { Input } from "@base-ui/react/input";
import { cn } from "../lib/cn";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { BrailleSpinner } from "./BrailleSpinner";
import { CheckmarkIcon } from "./CheckmarkIcon";
import type { FileProgress } from "../lib/schema";

const AI_PRIVACY_PROMPT = `I want you to perform a security and privacy audit of Tax UI, an open source tax return parser.

Repository: https://github.com/brianlovin/tax-ui

Please analyze the source code and verify:

1. DATA HANDLING
   - Tax return PDFs are sent directly to Anthropic's API for parsing
   - No data is sent to any other third-party servers
   - Parsed data is stored locally only

2. NETWORK ACTIVITY
   - Identify all network requests in the codebase
   - Verify the only external calls are to Anthropic's API
   - Check for any hidden data collection or tracking

3. API KEY SECURITY
   - Verify API keys are stored locally and not transmitted elsewhere
   - Check that keys are not logged or exposed

4. CODE INTEGRITY
   - Look for obfuscated or suspicious code
   - Review dependencies for anything concerning

Key files to review:
- src/index.ts (Bun server and API routes)
- src/lib/parser.ts (Claude API integration)
- src/lib/storage.ts (Local file storage)
- src/App.tsx (React frontend)

Report any privacy or security concerns. I'm considering using this app with sensitive tax data.`;

function FAQSection() {
  const [copied, setCopied] = useState(false);

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_PRIVACY_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = AI_PRIVACY_PROMPT;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="shrink-0 border-t border-(--color-border) p-4 px-5">
      <Accordion.Root className="space-y-px">
        <Accordion.Item value="data-safe">
          <Accordion.Header>
            <Accordion.Trigger className="w-full text-sm font-medium cursor-pointer flex items-center justify-between px-3 py-2.5 rounded-lg group focus:outline-none hover:bg-(--color-bg-muted) transition-colors">
              <span>How data is processed</span>
              <svg
                className="w-4 h-4 text-(--color-text-muted) group-data-[panel-open]:rotate-90 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className="text-sm text-(--color-text-muted) space-y-2 px-3 pt-1 pb-3">
            <p>
              Your tax data is processed locally and sent directly to
              Anthropic's API using your own API key. No data is stored on any
              third-party servers.
            </p>
            <p>
              Anthropic's commercial terms prohibit training models on API
              customer data.{" "}
              <a
                href="https://www.anthropic.com/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-(--color-text)"
              >
                Privacy policy
              </a>
            </p>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="how-sure">
          <Accordion.Header>
            <Accordion.Trigger className="w-full text-sm font-medium cursor-pointer flex items-center justify-between px-3 py-2.5 rounded-lg group focus:outline-none hover:bg-(--color-bg-muted) transition-colors">
              <span>Ask AI about privacy and security</span>
              <svg
                className="w-4 h-4 text-(--color-text-muted) group-data-[panel-open]:rotate-90 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className="text-sm text-(--color-text-muted) space-y-3 px-3 pt-1 pb-2">
            <p>
              Tax UI is open source. You can review the code yourself, or ask an
              AI to audit it for you.
            </p>
            <Button
              onClick={handleCopyPrompt}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              {copied ? "Copied!" : "Copy prompt"}
            </Button>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  isDemo: boolean;
  onUpload: (files: File[], apiKey: string) => Promise<void>;
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

export function OnboardingDialog({
  isOpen,
  isDemo,
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (isOpen && !isProcessing) {
      setFiles([]);
      setError(null);
    }
  }, [isOpen, isProcessing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

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
      addFiles(droppedFiles);
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
      addFiles(selectedFiles);
    } else if (e.target.files?.length) {
      setError("Please upload PDF files");
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleRemoveFile(index: number) {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((f, i) => ({
        ...f,
        isDuplicate: checkDuplicate(f.year, i),
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
        files.map((f) => f.file),
        apiKey.trim(),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process PDFs");
    } finally {
      setIsLoading(false);
    }
  }

  const processingCount =
    fileProgress?.filter((f) => f.status === "parsing").length ?? 0;
  const completedCount =
    fileProgress?.filter((f) => f.status === "complete").length ?? 0;
  const totalCount = fileProgress?.length ?? 0;
  const currentIndex = completedCount + processingCount;
  const showProcessingUI =
    isProcessing && fileProgress && fileProgress.length > 0;

  const nonDuplicateCount = files.filter((f) => !f.isDuplicate).length;
  const duplicateCount = files.filter((f) => f.isDuplicate).length;
  const isExtracting = files.some((f) => f.isExtracting);

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

  if (isDemo) {
    return (
      <Dialog
        open={isOpen}
        onClose={onClose}
        title="Tax UI"
        description=" This is a demo with sample data. To use Tax UI with
                your own tax returns, run it locally on your
                computer."
        size="lg"
        fullScreenMobile
        autoFocusClose
        skipOpenAnimation={skipOpenAnimation}
        footer={<FAQSection />}
      >
        <div>
          {/* Instructions */}
          <div className="mb-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Run locally</h3>
              <div className="bg-(--color-bg-muted) rounded-lg p-3 font-mono text-sm">
                <div className="text-(--color-text-muted)"># Clone and run</div>
                <div>git clone https://github.com/brianlovin/tax-ui</div>
                <div>cd tax-ui</div>
                <div>bun install</div>
                <div>bun run dev</div>
              </div>
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

          {/* Browse demo button */}
          <Button onClick={onClose} variant="secondary" className="w-full">
            Browse demo
          </Button>
        </div>
      </Dialog>
    );
  }

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
        {/* API Key Section */}
        {!hasStoredKey && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Anthropic API Key
            </label>
            <Input
              autoFocus
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              disabled={isLoading || isProcessing}
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
          </div>
        )}

        {/* Upload Section */}
        <div className="mb-6">
          <label className="block sr-only text-sm font-medium mb-2">
            Files
          </label>
          {!showProcessingUI && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() =>
                !isLoading && !isProcessing && fileInputRef.current?.click()
              }
              className={[
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-(--color-text-muted) bg-(--color-bg-muted)"
                  : "border-(--color-border) hover:border-(--color-text-muted)",
                isLoading || isProcessing
                  ? "opacity-50 cursor-not-allowed"
                  : "",
              ].join(" ")}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileSelect}
                disabled={isLoading || isProcessing}
                className="hidden"
              />
              <div className="text-(--color-text-muted)">
                <p className="text-sm">Drop your tax return PDFs here</p>
                <p className="text-xs mt-1 opacity-70">Click to browse</p>
              </div>
            </div>
          )}

          {/* File progress list during processing */}
          {showProcessingUI && (
            <div className="space-y-2">
              {fileProgress.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 text-sm bg-(--color-bg-muted) dark:bg-white/5 rounded-lg px-3 py-2"
                >
                  <span className="truncate flex-1">{file.filename}</span>
                  {file.status === "pending" && (
                    <span className="text-xs text-(--color-text-muted)">
                      Waiting
                    </span>
                  )}
                  {file.status === "parsing" && <BrailleSpinner />}
                  {file.status === "complete" && (
                    <CheckmarkIcon
                      size={16}
                      className="text-(--color-positive)"
                    />
                  )}
                  {file.status === "error" && (
                    <span className="text-(--color-negative)">Failed</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Selected files list (before processing) */}
          {!showProcessingUI && files.length > 0 && (
            <div className="mt-3 space-y-1">
              {files.map((fileEntry, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 text-sm rounded-lg px-3 pr-1 py-2",
                    fileEntry.isDuplicate
                      ? "bg-(--color-negative)/10 border border-(--color-negative)/20"
                      : "bg-(--color-bg-muted) dark:bg-white/5",
                  )}
                >
                  <span className="truncate flex-1 text-[13px]">
                    {fileEntry.file.name}
                  </span>
                  {fileEntry.isExtracting && (
                    <BrailleSpinner className="text-(--color-text-muted)" />
                  )}
                  {!fileEntry.isExtracting && fileEntry.year !== null && (
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        fileEntry.isDuplicate
                          ? "bg-(--color-negative)/20 text-(--color-negative)"
                          : "bg-black/5 dark:bg-white/5",
                      )}
                    >
                      {fileEntry.isDuplicate ? "Reprocess" : fileEntry.year}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(i);
                    }}
                    disabled={isLoading}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 text-sm text-(--color-negative)">{error}</div>
        )}

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
