import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode, Ref } from "react";
import { XMarkIcon } from "./XMarkIcon";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  fullScreenMobile?: boolean;
  showClose?: boolean;
  closeDisabled?: boolean;
  autoFocusClose?: boolean;
  contentRef?: Ref<HTMLDivElement>;
  skipOpenAnimation?: boolean;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

const fullScreenMobileSizeClasses = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  fullScreenMobile = false,
  showClose = true,
  closeDisabled = false,
  autoFocusClose = false,
  contentRef,
  skipOpenAnimation = false,
}: Props) {
  const noAnim = skipOpenAnimation ? " no-animation" : "";
  const popupClasses = fullScreenMobile
    ? `dialog-popup${noAnim} fixed z-50 bg-(--color-bg) dark:bg-(--color-bg-muted) shadow-2xl flex flex-col focus:outline-none inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full h-full sm:h-auto sm:max-h-[90vh] sm:ring ring-black/5 dark:ring-white/10 sm:rounded-2xl ${fullScreenMobileSizeClasses[size]}`
    : `dialog-popup${noAnim} fixed z-50 bg-(--color-bg) shadow-2xl flex flex-col focus:outline-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full ${sizeClasses[size]} ring ring-black/5 dark:ring-white/10 rounded-2xl`;
  const backdropClasses = `dialog-backdrop${noAnim} fixed inset-0 bg-(--color-overlay) backdrop-blur-[3px] z-40`;

  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(isOpen) => !isOpen && !closeDisabled && onClose()}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={backdropClasses} />
        <BaseDialog.Popup className={popupClasses}>
          {showClose && (
            <BaseDialog.Close
              autoFocus={autoFocusClose}
              disabled={closeDisabled}
              className="absolute rounded-full top-3 right-3 p-1.5 text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-bg-muted) disabled:opacity-50 z-10"
            >
              <XMarkIcon />
            </BaseDialog.Close>
          )}

          <div
            ref={contentRef}
            className={
              fullScreenMobile
                ? "flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 pt-6 pb-4 sm:pb-6"
                : "p-6"
            }
          >
            <div className="mb-4 pr-8">
              <BaseDialog.Title className="text-base font-medium">
                {title}
              </BaseDialog.Title>
              {description && (
                <p className="text-sm text-(--color-text-muted) mt-1">
                  {description}
                </p>
              )}
            </div>
            {children}
          </div>

          {footer}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
