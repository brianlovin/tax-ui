import { useState, useRef, useEffect, useCallback } from "react";
import Markdown from "react-markdown";
import { cn } from "../lib/cn";
import { BrailleSpinner } from "./BrailleSpinner";
import { Button } from "./Button";
import { XMarkIcon } from "./XMarkIcon";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  hasApiKey: boolean;
  isDemo: boolean;
  onSubmit: (prompt: string) => void;
  onNewChat: () => void;
  onClose: () => void;
  followUpSuggestions?: string[];
  isLoadingSuggestions?: boolean;
}

const WIDTH_STORAGE_KEY = "tax-chat-width";
const MIN_WIDTH = 320;
const MAX_WIDTH_PERCENT = 0.5;

function loadWidth(): number {
  try {
    const stored = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (stored) {
      return Math.max(MIN_WIDTH, parseInt(stored, 10));
    }
  } catch {
    // Ignore errors
  }
  return 360;
}

function saveWidth(width: number) {
  try {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Ignore errors
  }
}

export function Chat({
  messages,
  isLoading,
  hasApiKey,
  isDemo,
  onSubmit,
  onNewChat,
  onClose,
  followUpSuggestions,
  isLoadingSuggestions,
}: Props) {
  const [input, setInput] = useState("");
  const [width, setWidth] = useState(() => loadWidth());
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasTopOverflow, setHasTopOverflow] = useState(false);
  const [hasBottomOverflow, setHasBottomOverflow] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!isResizing) {
      saveWidth(width);
    }
  }, [width, isResizing]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const maxWidth = window.innerWidth * MAX_WIDTH_PERCENT;
      const newWidth = Math.min(
        maxWidth,
        Math.max(MIN_WIDTH, window.innerWidth - e.clientX),
      );
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const checkOverflow = () => {
      const hasVerticalScroll = container.scrollHeight > container.clientHeight;
      setHasTopOverflow(hasVerticalScroll && container.scrollTop > 1);
      setHasBottomOverflow(
        hasVerticalScroll &&
          container.scrollTop <
            container.scrollHeight - container.clientHeight - 1,
      );
    };

    checkOverflow();
    container.addEventListener("scroll", checkOverflow);
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(container);

    return () => {
      container.removeEventListener("scroll", checkOverflow);
      observer.disconnect();
    };
  }, [messages]);

  useEffect(() => {
    // Don't auto-focus on mobile - triggers keyboard unexpectedly
    if (!isMobile) {
      inputRef.current?.focus();
    }
  }, [isMobile]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const prompt = input.trim();
    if (prompt && !isLoading) {
      onSubmit(prompt);
      setInput("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const prompt = input.trim();
      if (prompt && !isLoading) {
        onSubmit(prompt);
        setInput("");
      }
    }
  }

  function handleNewChat() {
    onNewChat();
    inputRef.current?.focus();
  }

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-(--color-bg) border-l border-(--color-border) relative",
        isMobile && "fixed inset-0 z-40",
      )}
      style={isMobile ? undefined : { width }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-(--color-border) z-10 hidden md:block"
      />
      {/* Header */}
      <header className="h-12 pl-4 pr-2 flex items-center justify-between border-b border-(--color-border)">
        <span className="text-sm font-semibold">Chat</span>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleNewChat}>
              New
            </Button>
          )}
          <Button variant="ghost" size="sm" iconOnly onClick={onClose}>
            <XMarkIcon />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        {/* Top shadow */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-4 pointer-events-none z-10 transition-opacity duration-150",
            hasTopOverflow
              ? "opacity-100 shadow-[0_8px_16px_-8px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_16px_-8px_rgba(0,0,0,0.3)]"
              : "opacity-0",
          )}
        />
        <div ref={messagesContainerRef} className="h-full overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="h-full" />
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id}>
                  <div
                    className="text-xs mb-1"
                    style={{
                      color:
                        message.role === "assistant"
                          ? "rgb(217, 119, 87)"
                          : "var(--color-text-muted)",
                    }}
                  >
                    {message.role === "user" ? "You" : "Claude"}
                  </div>
                  <div className="text-sm prose-chat">
                    <Markdown
                      components={{
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-(--color-text-muted)"
                          >
                            {children}
                          </a>
                        ),
                        code: ({ children }) => (
                          <code className="prose-code px-1 py-0.5 bg-(--color-bg-muted) rounded text-xs font-mono">
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className="my-2 p-2 bg-(--color-bg-muted) rounded text-xs font-mono overflow-x-auto">
                            {children}
                          </pre>
                        ),
                        table: ({ children }) => (
                          <div className="my-2 overflow-x-auto">
                            <table className="text-xs border-collapse">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="border-b border-(--color-border)">
                            {children}
                          </thead>
                        ),
                        th: ({ children }) => (
                          <th className="text-left py-1 pr-4 font-medium text-(--color-text-muted)">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="py-1 pr-4 tabular-nums slashed-zero">{children}</td>
                        ),
                      }}
                    >
                      {message.content}
                    </Markdown>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div>
                  <div
                    className="text-xs mb-1"
                    style={{ color: "rgb(217, 119, 87)" }}
                  >
                    Claude
                  </div>
                  <BrailleSpinner className="text-sm" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Dynamic follow-up suggestions */}
      {messages.length > 0 &&
        !isLoading &&
        (isLoadingSuggestions ||
          (followUpSuggestions && followUpSuggestions.length > 0)) && (
          <div
            className={cn(
              "px-4 pb-2 pt-4 flex flex-wrap gap-2 transition-opacity duration-150 border-t border-(--color-border)",
              hasBottomOverflow &&
                "shadow-[0_-8px_8px_-8px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_16px_-8px_rgba(0,0,0,0.3)]",
            )}
            style={{
              opacity: input ? 0 : 1,
              pointerEvents: input ? "none" : "auto",
            }}
          >
            {!isLoadingSuggestions && (
              <span className="text-xs text-(--color-text-muted) mb-1">
                Suggested follow-ups
              </span>
            )}
            {isLoadingSuggestions ? (
              <BrailleSpinner className="text-xs text-(--color-text-muted)" />
            ) : (
              followUpSuggestions?.map((suggestion) => (
                <Button
                  key={suggestion}
                  size="sm"
                  variant="secondary"
                  onClick={() => onSubmit(suggestion)}
                  className="text-left text-[13px]"
                >
                  {suggestion}
                </Button>
              ))
            )}
          </div>
        )}

      {/* Suggestions - show when empty and no input */}
      {messages.length === 0 && (isDemo || hasApiKey) && (
        <div
          className="px-4 pb-2 space-y-2 transition-opacity duration-150"
          style={{
            opacity: input ? 0 : 1,
            pointerEvents: input ? "none" : "auto",
          }}
        >
          {[
            "Help me understand my tax returns",
            "How can I optimize next year?",
            "Look for mistakes in my tax return history",
          ].map((suggestion) => (
            <Button
              key={suggestion}
              variant="secondary"
              size="sm"
              onClick={() => onSubmit(suggestion)}
              className="block text-left text-[13px]"
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className={cn(
          "p-4 pt-2 pb-3",
          hasBottomOverflow &&
            !(
              messages.length > 0 &&
              !isLoading &&
              (isLoadingSuggestions ||
                (followUpSuggestions && followUpSuggestions.length > 0))
            ) &&
            "shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.1)] dark:shadow-[0_-8px_16px_-8px_rgba(0,0,0,0.3)]",
        )}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isDemo || hasApiKey ? "Ask anything..." : "Need API key"}
          disabled={(!isDemo && !hasApiKey) || isLoading}
          rows={3}
          className="w-full px-3 py-2.5 bg-(--color-bg-muted) rounded-lg text-base md:text-sm placeholder:text-(--color-text-muted) resize-none focus:outline-none disabled:opacity-50 overflow-y-auto"
        />
      </form>
    </div>
  );
}
