import { AnimatePresence, motion } from "motion/react";
import { Button } from "./Button";
import { BrailleSpinner } from "./BrailleSpinner";

type FileStatus =
  | "pending"
  | "extracting"
  | "ready"
  | "parsing"
  | "complete"
  | "error";

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
                "flex items-center gap-2 text-sm rounded-lg px-3 h-9",
                file.isDuplicate
                  ? "bg-(--color-negative)/10 border border-(--color-negative)/20"
                  : "bg-(--color-bg-muted)",
              ].join(" ")}
            >
              <span className="truncate flex-1 text-[13px]">
                {file.filename}
              </span>

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
          className="w-4 h-4 text-(--color-positive)"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
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
            "text-xs px-1.5 py-0.5 rounded",
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
