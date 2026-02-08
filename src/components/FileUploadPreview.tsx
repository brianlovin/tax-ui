import { AnimatePresence, motion } from "motion/react";

import { BrailleSpinner } from "./BrailleSpinner";
import { Button } from "./Button";

type FileStatus = "pending" | "extracting" | "ready" | "parsing" | "complete" | "error";

export interface DisplayFile {
  id: string;
  filename: string;
  year: number | null;
  status: FileStatus;
  isDuplicate: boolean;
  error?: string;
}

interface Props {
  files: DisplayFile[];
  onRemove?: (id: string) => void;
  disabled?: boolean;
}

export function FileUploadPreview({ files, onRemove, disabled }: Props) {
  if (files.length === 0) return null;

  return (
    <motion.div layout className="mt-3 space-y-1">
      <AnimatePresence mode="popLayout">
        {files.map((file) => (
          <motion.div
            key={file.id}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div
              className={[
                "flex h-9 items-center gap-2 rounded-lg px-3 text-sm",
                file.isDuplicate
                  ? "border border-(--color-negative)/20 bg-(--color-negative)/10"
                  : "bg-(--color-bg-muted)",
              ].join(" ")}
            >
              <span className="flex-1 truncate text-[13px]">{file.filename}</span>

              <div className="flex items-center">
                <FileStatusIndicator file={file} />

                {onRemove && file.status !== "extracting" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(file.id);
                    }}
                    disabled={disabled}
                    className="translate-x-2"
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
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function FileStatusIndicator({ file }: { file: DisplayFile }) {
  return (
    <AnimatePresence mode="wait">
      {file.status === "extracting" && (
        <motion.div
          key="extracting"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
        >
          <BrailleSpinner className="text-(--color-text-muted)" />
        </motion.div>
      )}
      {file.status === "pending" && (
        <motion.span
          key="pending"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="text-xs text-(--color-text-muted)"
        >
          Waiting
        </motion.span>
      )}
      {file.status === "parsing" && (
        <motion.div
          key="parsing"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
        >
          <BrailleSpinner />
        </motion.div>
      )}
      {file.status === "complete" && (
        <motion.svg
          key="complete"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{ duration: 0.15 }}
          className="h-4 w-4 text-(--color-positive)"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </motion.svg>
      )}
      {file.status === "error" && (
        <motion.span
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="text-xs text-(--color-negative)"
        >
          Failed
        </motion.span>
      )}
      {file.status === "ready" && file.year !== null && (
        <motion.span
          key="year"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
          className={[
            "rounded px-1.5 py-0.5 text-xs",
            file.isDuplicate
              ? "bg-(--color-negative)/20 text-(--color-negative)"
              : "bg-(--color-bg-muted)",
          ].join(" ")}
        >
          {file.isDuplicate ? "Reprocess" : file.year}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
