import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { Button } from "./Button";
import { type DisplayFile, FileUploadPreview } from "./FileUploadPreview";

interface Scenario {
  name: string;
  description: string;
  hasStoredKey: boolean;
  isProcessing: boolean;
  files: DisplayFile[];
}

const SCENARIOS: Scenario[] = [
  // Pre-processing states
  {
    name: "1. New user - empty",
    description: "No API key, no files",
    hasStoredKey: false,
    isProcessing: false,
    files: [],
  },
  {
    name: "2. New user - with key",
    description: "API key entered, no files",
    hasStoredKey: false,
    isProcessing: false,
    files: [],
  },
  {
    name: "3. New user - extracting",
    description: "Files added, year extraction in progress",
    hasStoredKey: false,
    isProcessing: false,
    files: [
      {
        id: "f1",
        filename: "tax-return-2024.pdf",
        year: null,
        status: "extracting",
        isDuplicate: false,
      },
      {
        id: "f2",
        filename: "1040-2023.pdf",
        year: null,
        status: "extracting",
        isDuplicate: false,
      },
    ],
  },
  {
    name: "4. New user - ready",
    description: "Years extracted, ready to submit",
    hasStoredKey: false,
    isProcessing: false,
    files: [
      {
        id: "f1",
        filename: "tax-return-2024.pdf",
        year: 2024,
        status: "ready",
        isDuplicate: false,
      },
      {
        id: "f2",
        filename: "1040-2023.pdf",
        year: 2023,
        status: "ready",
        isDuplicate: false,
      },
    ],
  },
  {
    name: "5. New user - duplicates",
    description: "Some files are duplicates of existing years",
    hasStoredKey: false,
    isProcessing: false,
    files: [
      {
        id: "f1",
        filename: "tax-return-2024.pdf",
        year: 2024,
        status: "ready",
        isDuplicate: true,
      },
      {
        id: "f2",
        filename: "1040-2023.pdf",
        year: 2023,
        status: "ready",
        isDuplicate: false,
      },
    ],
  },
  // Post-API-key states (returning user)
  {
    name: "6. Returning user - empty",
    description: "Has stored key (masked), no files",
    hasStoredKey: true,
    isProcessing: false,
    files: [],
  },
  {
    name: "7. Returning user - ready",
    description: "Has stored key, files ready",
    hasStoredKey: true,
    isProcessing: false,
    files: [
      {
        id: "f1",
        filename: "tax-return-2024.pdf",
        year: 2024,
        status: "ready",
        isDuplicate: false,
      },
      {
        id: "f2",
        filename: "1040-2023.pdf",
        year: 2023,
        status: "ready",
        isDuplicate: false,
      },
    ],
  },
  // Processing states
  {
    name: "8. Processing - start",
    description: "First file parsing, others pending",
    hasStoredKey: true,
    isProcessing: true,
    files: [
      {
        id: "f1",
        filename: "tax-return-2024.pdf",
        year: 2024,
        status: "parsing",
        isDuplicate: false,
      },
      {
        id: "f2",
        filename: "1040-2023.pdf",
        year: 2023,
        status: "pending",
        isDuplicate: false,
      },
      {
        id: "f3",
        filename: "federal-2022.pdf",
        year: 2022,
        status: "pending",
        isDuplicate: false,
      },
    ],
  },
  {
    name: "9. Processing - middle",
    description: "First complete, second parsing, third pending",
    hasStoredKey: true,
    isProcessing: true,
    files: [
      {
        id: "f1",
        filename: "tax-return-2024.pdf",
        year: 2024,
        status: "complete",
        isDuplicate: false,
      },
      {
        id: "f2",
        filename: "1040-2023.pdf",
        year: 2023,
        status: "parsing",
        isDuplicate: false,
      },
      {
        id: "f3",
        filename: "federal-2022.pdf",
        year: 2022,
        status: "pending",
        isDuplicate: false,
      },
    ],
  },
  {
    name: "10. Processing - complete",
    description: "All files complete",
    hasStoredKey: true,
    isProcessing: true,
    files: [
      {
        id: "f1",
        filename: "tax-return-2024.pdf",
        year: 2024,
        status: "complete",
        isDuplicate: false,
      },
      {
        id: "f2",
        filename: "1040-2023.pdf",
        year: 2023,
        status: "complete",
        isDuplicate: false,
      },
      {
        id: "f3",
        filename: "federal-2022.pdf",
        year: 2022,
        status: "complete",
        isDuplicate: false,
      },
    ],
  },
  {
    name: "11. Processing - mixed",
    description: "One error, one complete, one parsing",
    hasStoredKey: true,
    isProcessing: true,
    files: [
      {
        id: "f1",
        filename: "corrupted-file.pdf",
        year: 2024,
        status: "error",
        isDuplicate: false,
        error: "Failed to parse",
      },
      {
        id: "f2",
        filename: "1040-2023.pdf",
        year: 2023,
        status: "complete",
        isDuplicate: false,
      },
      {
        id: "f3",
        filename: "federal-2022.pdf",
        year: 2022,
        status: "parsing",
        isDuplicate: false,
      },
    ],
  },
];

function getButtonText(scenario: Scenario): string {
  if (scenario.isProcessing) {
    const complete = scenario.files.filter((f) => f.status === "complete").length;
    const total = scenario.files.length;
    if (complete === total) return "Done";
    return `Processing ${complete + 1} of ${total}...`;
  }

  const readyFiles = scenario.files.filter((f) => f.status === "ready");
  if (readyFiles.length === 0) return "Process";
  return `Process ${readyFiles.length} file${readyFiles.length > 1 ? "s" : ""}`;
}

function isButtonDisabled(scenario: Scenario): boolean {
  if (scenario.isProcessing) return true;
  const readyFiles = scenario.files.filter((f) => f.status === "ready");
  return readyFiles.length === 0;
}

interface Props {
  onClose: () => void;
}

export function SetupDialogPreview({ onClose }: Props) {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const scenario = SCENARIOS[scenarioIndex]!;

  const next = () => setScenarioIndex((i) => (i + 1) % SCENARIOS.length);
  const prev = () => setScenarioIndex((i) => (i - 1 + SCENARIOS.length) % SCENARIOS.length);

  useHotkeys("left", prev, { preventDefault: true });
  useHotkeys("right", next, { preventDefault: true });
  useHotkeys("escape", onClose, { preventDefault: true });

  const dialogTitle = scenario.hasStoredKey ? "Upload tax returns" : "Tax UI";
  const dialogDescription = scenario.hasStoredKey
    ? "Upload more tax returns"
    : "Make sense of your tax returns";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-(--color-overlay) backdrop-blur-[3px]"
        onClick={onClose}
      />

      {/* Container for dialog + controls */}
      <div className="fixed top-1/2 left-1/2 z-50 flex w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-6">
        {/* Dialog - matches Dialog.tsx styling */}
        <div className="rounded-2xl bg-(--color-bg-elevated) shadow-2xl ring ring-(--color-ring-elevated)">
          <div className="p-6">
            {/* Header - matches Dialog.tsx */}
            <div className="mb-4 pr-8">
              <h2 className="text-lg font-semibold">{dialogTitle}</h2>
              <p className="mt-1 text-sm text-(--color-text-muted)">{dialogDescription}</p>
            </div>

            {/* Content - matches SetupDialog.tsx structure */}
            <div>
              {/* API Key Section */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium">Anthropic API Key</label>
                {scenario.hasStoredKey ? (
                  <div className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2.5 text-sm text-(--color-text-muted)">
                    sk-ant-•••••••••••••••
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="sk-ant-..."
                      disabled={scenario.isProcessing}
                      className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-muted) px-3 py-2.5 text-sm placeholder:text-(--color-text-muted) focus:border-(--color-text-muted) focus:outline-none disabled:opacity-50"
                    />
                    <p className="mt-2 text-xs text-(--color-text-muted)">
                      Get your API key from <span className="underline">console.anthropic.com</span>
                    </p>
                  </>
                )}
              </div>

              {/* Upload Section */}
              <div className="mb-6">
                {/* Drop zone - matches SetupDialog.tsx */}
                <div
                  className={[
                    "rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200",
                    "border-(--color-border) hover:border-(--color-text-muted)",
                    scenario.isProcessing ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                  ].join(" ")}
                >
                  <div className="text-(--color-text-muted)">
                    <p className="text-sm">Drop your tax return PDFs here</p>
                    <p className="mt-1 text-xs opacity-70">Click to browse</p>
                  </div>
                </div>

                {/* File list - uses real FileUploadPreview */}
                <FileUploadPreview
                  files={scenario.files}
                  onRemove={scenario.isProcessing ? undefined : () => {}}
                  disabled={scenario.isProcessing}
                />
              </div>

              {/* Submit button - uses real Button */}
              <Button disabled={isButtonDisabled(scenario)} className="w-full">
                {getButtonText(scenario)}
              </Button>
            </div>
          </div>
        </div>

        {/* Control panel */}
        <div className="flex items-center justify-between rounded-xl bg-(--color-bg-elevated) px-4 py-2.5 shadow-xl ring ring-(--color-ring-elevated)">
          <button
            onClick={prev}
            className="rounded-lg bg-(--color-bg-muted) px-2.5 py-1 text-sm select-none hover:bg-(--color-border)"
          >
            ←
          </button>

          <div className="text-center">
            <div className="text-sm font-medium">{scenario.name}</div>
            <div className="text-xs text-(--color-text-muted)">{scenario.description}</div>
          </div>

          <button
            onClick={next}
            className="rounded-lg bg-(--color-bg-muted) px-2.5 py-1 text-sm select-none hover:bg-(--color-border)"
          >
            →
          </button>
        </div>
      </div>
    </>
  );
}
