import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { FAQSection } from "./FAQSection";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  skipOpenAnimation?: boolean;
}

export function DemoDialog({ isOpen, onClose, skipOpenAnimation }: Props) {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Tax UI"
      description="This is a demo with sample data. To use Tax UI with your own tax returns, run it locally on your computer."
      size="lg"
      fullScreenMobile
      autoFocusClose
      skipOpenAnimation={skipOpenAnimation}
      footer={<FAQSection />}
    >
      <div>
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

        <Button onClick={onClose} variant="secondary" className="w-full">
          Browse demo
        </Button>
      </div>
    </Dialog>
  );
}
