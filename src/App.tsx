import { useState, useEffect, useCallback, useRef } from "react";
import type { TaxReturn, PendingUpload, FileProgress } from "./lib/schema";
import type { NavItem } from "./lib/types";
import { sampleReturns } from "./data/sampleData";
import { MainPanel } from "./components/MainPanel";
import { UploadModal } from "./components/UploadModal";
import { SettingsModal } from "./components/SettingsModal";
import { ResetDialog } from "./components/ResetDialog";
import { OnboardingDialog } from "./components/OnboardingDialog";
import { Chat, type ChatMessage } from "./components/Chat";
import { Button } from "./components/Button";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DevTools, cycleDemoOverride } from "./components/DevTools";
import { extractYearFromFilename } from "./lib/year-extractor";
import "./index.css";

const CHAT_OPEN_KEY = "tax-chat-open";
const CHAT_HISTORY_KEY = "tax-chat-history";
const DEV_DEMO_OVERRIDE_KEY = "dev-demo-override";

function isClientDemo(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1";
}

const DEMO_RESPONSE = `This is a demo with sample data. To chat about your own tax returns, clone and run [Tax UI](https://github.com/brianlovin/tax-ui) locally:
\`\`\`
git clone https://github.com/brianlovin/tax-ui
cd tax-ui
bun install
bun run dev
\`\`\`
You'll need [Bun](https://bun.sh) and an [Anthropic API key](https://console.anthropic.com).`;

function loadChatMessages(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(CHAT_HISTORY_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveChatMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
  } catch {}
}

type SelectedView = "summary" | number | `pending:${string}`;

interface AppState {
  returns: Record<number, TaxReturn>;
  hasStoredKey: boolean;
  selectedYear: SelectedView;
  isLoading: boolean;
  hasUserData: boolean;
  isDemo: boolean;
  isDev: boolean;
}

async function fetchInitialState(): Promise<
  Pick<
    AppState,
    "returns" | "hasStoredKey" | "hasUserData" | "isDemo" | "isDev"
  >
> {
  // In production (static hosting), skip API calls and use sample data
  if (isClientDemo()) {
    return {
      hasStoredKey: false,
      returns: {},
      hasUserData: false,
      isDemo: true,
      isDev: false,
    };
  }

  const [configRes, returnsRes] = await Promise.all([
    fetch("/api/config"),
    fetch("/api/returns"),
  ]);
  const { hasKey, isDemo, isDev } = await configRes.json();
  const returns = await returnsRes.json();
  const hasUserData = Object.keys(returns).length > 0;
  return {
    hasStoredKey: hasKey,
    returns,
    hasUserData,
    isDemo: isDemo ?? false,
    isDev: isDev ?? false,
  };
}

function getDefaultSelection(returns: Record<number, TaxReturn>): SelectedView {
  const years = Object.keys(returns)
    .map(Number)
    .sort((a, b) => a - b);
  if (years.length === 0) return "summary";
  if (years.length === 1) return years[0] ?? "summary";
  return "summary";
}

function buildNavItems(returns: Record<number, TaxReturn>): NavItem[] {
  const years = Object.keys(returns)
    .map(Number)
    .sort((a, b) => b - a);
  const items: NavItem[] = [];
  if (years.length > 1) items.push({ id: "summary", label: "All time" });
  items.push(...years.map((y) => ({ id: String(y), label: String(y) })));
  return items;
}

function parseSelectedId(id: string): SelectedView {
  if (id === "summary") return "summary";
  if (id.startsWith("pending:")) return id as `pending:${string}`;
  return Number(id);
}

export function App() {
  const [state, setState] = useState<AppState>({
    returns: sampleReturns,
    hasStoredKey: false,
    selectedYear: "summary",
    isLoading: true,
    hasUserData: false,
    isDemo: isClientDemo(),
    isDev: false,
  });
  const [devDemoOverride, setDevDemoOverride] = useState<boolean | null>(() => {
    const stored = localStorage.getItem(DEV_DEMO_OVERRIDE_KEY);
    return stored === null ? null : stored === "true";
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [configureKeyOnly, setConfigureKeyOnly] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(() => {
    const stored = localStorage.getItem(CHAT_OPEN_KEY);
    if (stored !== null) {
      return stored === "true";
    }
    // Default: closed on mobile, open on desktop
    return typeof window !== "undefined" && window.innerWidth >= 768;
  });
  const [openModal, setOpenModal] = useState<
    "settings" | "reset" | "onboarding" | null
  >(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [isOnboardingProcessing, setIsOnboardingProcessing] = useState(false);
  const [onboardingProgress, setOnboardingProgress] = useState<FileProgress[]>(
    [],
  );
  const [isDark, setIsDark] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [devTriggerError, setDevTriggerError] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    loadChatMessages(),
  );
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [pendingAutoMessage, setPendingAutoMessage] = useState<string | null>(
    null,
  );
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const hasShownOnboardingRef = useRef(false);

  // Compute effective demo mode early (dev override takes precedence)
  const effectiveIsDemo =
    devDemoOverride !== null ? devDemoOverride : state.isDemo;

  // Hide chat on mobile in demo mode
  const shouldShowChat = !effectiveIsDemo || !isMobile;

  // When demo mode is toggled on, show sample data instead of user data
  const effectiveReturns = effectiveIsDemo ? sampleReturns : state.returns;
  const navItems = buildNavItems(effectiveReturns);

  useEffect(() => {
    fetchInitialState()
      .then(({ returns, hasStoredKey, hasUserData, isDemo, isDev }) => {
        // Use user data if available, otherwise show sample data
        const effectiveReturns = hasUserData ? returns : sampleReturns;
        setState({
          returns: effectiveReturns,
          hasStoredKey,
          selectedYear: getDefaultSelection(effectiveReturns),
          isLoading: false,
          hasUserData,
          isDemo,
          isDev,
        });
      })
      .catch((err) => {
        console.error("Failed to load:", err);
        setState((s) => ({ ...s, isLoading: false }));
      });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    localStorage.setItem(CHAT_OPEN_KEY, String(isChatOpen));
  }, [isChatOpen]);

  useEffect(() => {
    saveChatMessages(chatMessages);
  }, [chatMessages]);

  // Auto-submit pending message when chat is ready
  useEffect(() => {
    if (pendingAutoMessage && isChatOpen && !isChatLoading) {
      submitChatMessage(pendingAutoMessage);
      setPendingAutoMessage(null);
    }
  }, [pendingAutoMessage, isChatOpen, isChatLoading]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const currentId =
        state.selectedYear === "summary"
          ? "summary"
          : String(state.selectedYear);
      const selectedIndex = navItems.findIndex((item) => item.id === currentId);

      if (e.key === "j" && selectedIndex < navItems.length - 1) {
        const nextItem = navItems[selectedIndex + 1];
        if (nextItem) {
          setState((s) => ({
            ...s,
            selectedYear: parseSelectedId(nextItem.id),
          }));
        }
      }
      if (e.key === "k" && selectedIndex > 0) {
        const prevItem = navItems[selectedIndex - 1];
        if (prevItem) {
          setState((s) => ({
            ...s,
            selectedYear: parseSelectedId(prevItem.id),
          }));
        }
      }
    },
    [state.selectedYear, navItems],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  async function processUpload(file: File, apiKey: string): Promise<TaxReturn> {
    const formData = new FormData();
    formData.append("pdf", file);
    if (apiKey) formData.append("apiKey", apiKey);

    const res = await fetch("/api/parse", { method: "POST", body: formData });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || `HTTP ${res.status}`);
    }

    const taxReturn: TaxReturn = await res.json();
    const returnsRes = await fetch("/api/returns");
    const returns = await returnsRes.json();

    setState((s) => ({
      ...s,
      returns,
      hasStoredKey: true,
      hasUserData: true,
      // Stay on summary if already there, otherwise navigate to new year
      selectedYear: s.selectedYear === "summary" ? "summary" : taxReturn.year,
    }));

    return taxReturn;
  }

  async function handleUploadFromSidebar(files: File[]) {
    if (files.length === 0) return;

    // If no API key, open modal with all files
    if (!state.hasStoredKey) {
      setPendingFiles(files);
      setIsModalOpen(true);
      return;
    }

    // Create pending uploads immediately (optimistic) for all files
    const newPendingUploads: PendingUpload[] = files.map((file) => {
      const filenameYear = extractYearFromFilename(file.name);
      return {
        id: crypto.randomUUID(),
        filename: file.name,
        year: filenameYear,
        status: filenameYear ? "parsing" : "extracting-year",
        file,
      };
    });

    setPendingUploads((prev) => [...prev, ...newPendingUploads]);

    // Select the first pending upload
    const firstPending = newPendingUploads[0];
    if (firstPending) {
      setState((s) => ({ ...s, selectedYear: `pending:${firstPending.id}` }));
    }

    // Extract years in parallel for files that don't have one from filename
    await Promise.all(
      newPendingUploads
        .filter((p) => !p.year)
        .map(async (pending) => {
          try {
            const formData = new FormData();
            formData.append("pdf", pending.file);
            const yearRes = await fetch("/api/extract-year", {
              method: "POST",
              body: formData,
            });
            const { year: extractedYear } = await yearRes.json();
            setPendingUploads((prev) =>
              prev.map((p) =>
                p.id === pending.id
                  ? { ...p, year: extractedYear, status: "parsing" }
                  : p,
              ),
            );
          } catch (err) {
            console.error("Year extraction failed:", err);
            setPendingUploads((prev) =>
              prev.map((p) =>
                p.id === pending.id ? { ...p, status: "parsing" } : p,
              ),
            );
          }
        }),
    );

    // Process files sequentially (full parsing)
    setIsUploading(true);
    let successfulUploads = 0;
    for (const pending of newPendingUploads) {
      try {
        await processUpload(pending.file, "");
        successfulUploads++;
        // Remove from pending uploads after success
        setPendingUploads((prev) => prev.filter((p) => p.id !== pending.id));
      } catch (err) {
        console.error("Upload failed:", err);
        // Remove from pending uploads on error, but continue processing others
        setPendingUploads((prev) => prev.filter((p) => p.id !== pending.id));
      }
    }
    setIsUploading(false);

    // Navigate to appropriate view after all uploads complete
    setState((s) => ({
      ...s,
      selectedYear: getDefaultSelection(s.returns),
    }));

    // Auto-trigger chat after successful upload
    if (successfulUploads > 0) {
      const autoMessage =
        files.length === 1
          ? "Help me understand my year"
          : "Help me understand my history of income and taxes";
      setPendingAutoMessage(autoMessage);
      setIsChatOpen(true);
    }
  }

  async function handleUploadFromModal(files: File[], apiKey: string) {
    for (const file of files) {
      await processUpload(file, apiKey);
    }
    setPendingFiles([]);
  }

  async function handleSaveApiKey(apiKey: string) {
    const res = await fetch("/api/config/key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || `HTTP ${res.status}`);
    }
    setState((s) => ({ ...s, hasStoredKey: true }));
  }

  async function handleClearData() {
    const res = await fetch("/api/clear-data", { method: "POST" });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || `HTTP ${res.status}`);
    }
    // Reset to initial state with sample data
    setState((s) => ({
      returns: sampleReturns,
      hasStoredKey: false,
      selectedYear: "summary",
      isLoading: false,
      hasUserData: false,
      isDemo: s.isDemo,
      isDev: s.isDev,
    }));
    // Clear chat data
    localStorage.removeItem(CHAT_OPEN_KEY);
    localStorage.removeItem(CHAT_HISTORY_KEY);
    localStorage.removeItem("tax-chat-width");
    setChatMessages([]);
    // Reset chat to open (default for new users)
    setIsChatOpen(true);
  }

  async function submitChatMessage(prompt: string) {
    if (!prompt || isChatLoading) return;

    // Clear follow-up suggestions when sending a new message
    setFollowUpSuggestions([]);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setIsChatLoading(true);

    // In demo mode, return a hardcoded response
    if (effectiveIsDemo) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: DEMO_RESPONSE,
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
      setIsChatLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          history: chatMessages,
          returns: effectiveReturns,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || `HTTP ${res.status}`);
      }

      const { response } = await res.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
      };

      setChatMessages((prev) => [...prev, assistantMessage]);

      // Fetch follow-up suggestions (non-blocking)
      setIsLoadingSuggestions(true);
      fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [...chatMessages, userMessage, assistantMessage],
          returns: effectiveReturns,
        }),
      })
        .then((res) => res.json())
        .then(({ suggestions }) => setFollowUpSuggestions(suggestions || []))
        .catch(() => setFollowUpSuggestions([]))
        .finally(() => setIsLoadingSuggestions(false));
    } catch (err) {
      console.error("Chat error:", err);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Failed to get response"}`,
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }

  function handleNewChat() {
    setChatMessages([]);
    saveChatMessages([]);
    setFollowUpSuggestions([]);
  }

  function handleSelect(id: string) {
    setState((s) => ({
      ...s,
      selectedYear: parseSelectedId(id),
    }));
  }

  async function handleDelete(id: string) {
    const year = Number(id);
    if (isNaN(year)) return;

    await fetch(`/api/returns/${year}`, { method: "DELETE" });

    setState((s) => {
      const newReturns = { ...s.returns };
      delete newReturns[year];
      const newSelection =
        s.selectedYear === year
          ? getDefaultSelection(newReturns)
          : s.selectedYear;
      return {
        ...s,
        returns: newReturns,
        selectedYear: newSelection,
      };
    });
  }

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-sm text-(--color-text-muted)">Loading...</span>
      </div>
    );
  }

  function getSelectedId(): string {
    if (
      typeof state.selectedYear === "string" &&
      state.selectedYear.startsWith("pending:")
    ) {
      return state.selectedYear;
    }
    if (state.selectedYear === "summary") return "summary";
    return String(state.selectedYear);
  }
  const selectedId = getSelectedId();

  function getReceiptData(): TaxReturn | null {
    if (typeof state.selectedYear === "number") {
      return effectiveReturns[state.selectedYear] || null;
    }
    return null;
  }

  function renderMainPanel() {
    const commonProps = {
      isChatOpen,
      isChatLoading,
      onToggleChat: () => setIsChatOpen(!isChatOpen),
      showChatButton: shouldShowChat,
      navItems,
      selectedId,
      onSelect: handleSelect,
      onOpenStart: () => setOpenModal("onboarding"),
      onOpenReset: () => setOpenModal("reset"),
      onDeleteYear: handleDelete,
      isDemo: effectiveIsDemo,
      hasUserData: state.hasUserData,
    };

    if (selectedPendingUpload) {
      return (
        <MainPanel
          view="loading"
          pendingUpload={selectedPendingUpload}
          {...commonProps}
        />
      );
    }
    if (state.selectedYear === "summary") {
      return (
        <MainPanel view="summary" returns={effectiveReturns} {...commonProps} />
      );
    }
    const receiptData = getReceiptData();
    if (receiptData) {
      return (
        <MainPanel
          view="receipt"
          data={receiptData}
          title={String(state.selectedYear)}
          {...commonProps}
        />
      );
    }
    return (
      <MainPanel view="summary" returns={effectiveReturns} {...commonProps} />
    );
  }

  // Find pending upload if selected
  const selectedPendingUpload =
    typeof state.selectedYear === "string" &&
    state.selectedYear.startsWith("pending:")
      ? pendingUploads.find((p) => `pending:${p.id}` === state.selectedYear)
      : null;

  // Show onboarding dialog for new users (unless dismissed) or when manually opened
  // Processing takes precedence - keep dialog open while processing
  const showOnboarding =
    isOnboardingProcessing ||
    openModal === "onboarding" ||
    (!onboardingDismissed && !state.hasStoredKey && !state.hasUserData);

  // Skip open animation only on first automatic show (not manual reopen)
  const skipOnboardingAnimation =
    showOnboarding &&
    !hasShownOnboardingRef.current &&
    openModal !== "onboarding";
  if (showOnboarding && !hasShownOnboardingRef.current) {
    hasShownOnboardingRef.current = true;
  }

  function getPostUploadNavigation(
    existingYears: number[],
    uploadedYears: number[],
    batchSize: number,
  ): SelectedView {
    if (uploadedYears.length === 0) return "summary"; // all failed
    if (batchSize === 1) return uploadedYears[0]!; // single file -> that year
    return "summary"; // multiple files -> summary
  }

  async function handleOnboardingUpload(files: File[], apiKey: string) {
    setIsOnboardingProcessing(true);
    const existingYears = Object.keys(state.returns).map(Number);

    // Initialize progress
    const progress: FileProgress[] = files.map((f) => ({
      id: crypto.randomUUID(),
      filename: f.name,
      status: "pending" as const,
    }));
    setOnboardingProgress(progress);

    // Save API key if needed
    if (!state.hasStoredKey && apiKey) {
      await handleSaveApiKey(apiKey);
    }

    // Process files with progress updates
    const uploadedYears: number[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const id = progress[i]!.id;

      setOnboardingProgress((p) =>
        p.map((f) => (f.id === id ? { ...f, status: "parsing" } : f)),
      );

      try {
        const taxReturn = await processUpload(file, apiKey);
        uploadedYears.push(taxReturn.year);
        setOnboardingProgress((p) =>
          p.map((f) =>
            f.id === id
              ? { ...f, status: "complete", year: taxReturn.year }
              : f,
          ),
        );
      } catch (err) {
        setOnboardingProgress((p) =>
          p.map((f) =>
            f.id === id
              ? {
                  ...f,
                  status: "error",
                  error: err instanceof Error ? err.message : "Failed",
                }
              : f,
          ),
        );
      }
    }

    // Smart routing
    const nav = getPostUploadNavigation(
      existingYears,
      uploadedYears,
      files.length,
    );
    setState((s) => ({ ...s, selectedYear: nav }));

    setIsOnboardingProcessing(false);
    setOpenModal(null);
    setOnboardingProgress([]);

    // Auto-trigger chat after successful upload
    if (uploadedYears.length > 0) {
      const autoMessage =
        files.length === 1
          ? "Help me understand my year"
          : "Help me understand my history of income and taxes";
      setPendingAutoMessage(autoMessage);
      setIsChatOpen(true);
    }
  }

  function handleOnboardingClose() {
    setOpenModal(null);
    setOnboardingDismissed(true);
  }

  // Dev helper: throws during render to test ErrorBoundary
  if (devTriggerError) {
    throw new Error("Test error triggered from dev tools");
  }

  return (
    <div className="flex h-screen">
      <ErrorBoundary name="Main Panel">{renderMainPanel()}</ErrorBoundary>

      {shouldShowChat && isChatOpen && (
        <ErrorBoundary name="Chat">
          <Chat
            messages={chatMessages}
            isLoading={isChatLoading}
            hasApiKey={state.hasStoredKey}
            isDemo={effectiveIsDemo}
            onSubmit={submitChatMessage}
            onNewChat={handleNewChat}
            onClose={() => setIsChatOpen(false)}
            followUpSuggestions={followUpSuggestions}
            isLoadingSuggestions={isLoadingSuggestions}
          />
        </ErrorBoundary>
      )}

      <OnboardingDialog
        isOpen={showOnboarding}
        isDemo={effectiveIsDemo}
        onUpload={handleOnboardingUpload}
        onClose={handleOnboardingClose}
        isProcessing={isOnboardingProcessing}
        fileProgress={onboardingProgress}
        hasStoredKey={state.hasStoredKey}
        existingYears={Object.keys(state.returns).map(Number)}
        skipOpenAnimation={skipOnboardingAnimation}
      />

      <UploadModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setPendingFiles([]);
          setConfigureKeyOnly(false);
        }}
        onUpload={handleUploadFromModal}
        onSaveApiKey={handleSaveApiKey}
        hasStoredKey={state.hasStoredKey}
        pendingFiles={pendingFiles}
        configureKeyOnly={configureKeyOnly}
      />

      <SettingsModal
        isOpen={openModal === "settings"}
        onClose={() => setOpenModal(null)}
        hasApiKey={state.hasStoredKey}
        onSaveApiKey={handleSaveApiKey}
        onClearData={handleClearData}
      />

      <ResetDialog
        isOpen={openModal === "reset"}
        onClose={() => setOpenModal(null)}
        onReset={handleClearData}
      />

      {/* Get started pill - show in demo mode when onboarding was dismissed */}
      {effectiveIsDemo && onboardingDismissed && !showOnboarding && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <Button variant="pill" onClick={() => setOpenModal("onboarding")}>
            Get started
          </Button>
        </div>
      )}

      {state.isDev && (
        <DevTools
          devDemoOverride={devDemoOverride}
          onDemoOverrideChange={setDevDemoOverride}
          onTriggerError={() => setDevTriggerError(true)}
        />
      )}
    </div>
  );
}

export default App;
