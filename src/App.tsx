import "./index.css";

import { useCallback, useEffect, useRef, useState } from "react";

import { Chat, type ChatMessage } from "./components/Chat";
import { DemoDialog } from "./components/DemoDialog";
import { DevTools } from "./components/DevTools";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MainPanel } from "./components/MainPanel";
import { ResetDialog } from "./components/ResetDialog";
import { SettingsModal } from "./components/SettingsModal";
import { SetupDialog } from "./components/SetupDialog";
import { UploadModal } from "./components/UploadModal";
import { sampleReturns } from "./data/sampleData";
import { isElectron } from "./lib/electron";
import { getDevDemoOverride, isHostedEnvironment, resolveDemoMode } from "./lib/env";
import type { FileProgress, FileWithId, PendingUpload, TaxReturn } from "./lib/schema";
import type { NavItem } from "./lib/types";
import { extractYearFromFilename } from "./lib/year-extractor";

export type UpdateStatus = "available" | "downloading" | "ready";

function useElectronUpdater(devOverride: UpdateStatus | null) {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isElectron()) return;
    const api = window.electronAPI?.update;
    if (!api) return;

    const unsubs: (() => void)[] = [];

    if (api.onAvailable) {
      unsubs.push(
        api.onAvailable((data) => {
          setVersion(data.version);
          setStatus("available");
        }),
      );
    }
    if (api.onProgress) {
      unsubs.push(
        api.onProgress((data) => {
          setStatus("downloading");
          setProgress(Math.round(data.percent));
        }),
      );
    }
    if (api.onDownloaded) {
      unsubs.push(
        api.onDownloaded(() => {
          setStatus("ready");
        }),
      );
    }
    if (api.onError) {
      unsubs.push(
        api.onError((data) => {
          console.error("Auto-update error:", data.message);
          setStatus(null);
        }),
      );
    }

    return () => unsubs.forEach((fn) => fn());
  }, []);

  const effective = devOverride ?? status;

  if (!effective) return null;

  return {
    status: effective,
    version: devOverride ? "0.0.0-dev" : version,
    progress: devOverride === "downloading" ? 42 : progress,
    download: () => window.electronAPI?.update?.download?.(),
    install: () => window.electronAPI?.update?.install?.(),
  };
}

const CHAT_OPEN_KEY = "tax-chat-open";
const CHAT_HISTORY_KEY = "tax-chat-history";
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
  Pick<AppState, "returns" | "hasStoredKey" | "hasUserData" | "isDemo" | "isDev">
> {
  // In production (static hosting), skip API calls and use sample data
  if (isHostedEnvironment()) {
    return {
      hasStoredKey: false,
      returns: {},
      hasUserData: false,
      isDemo: true,
      isDev: false,
    };
  }

  const [configRes, returnsRes] = await Promise.all([fetch("/api/config"), fetch("/api/returns")]);
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
    isDemo: isHostedEnvironment(),
    isDev: false,
  });
  const [devDemoOverride, setDevDemoOverride] = useState<boolean | null>(getDevDemoOverride);
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
  const [openModal, setOpenModal] = useState<"settings" | "reset" | "onboarding" | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [isOnboardingProcessing, setIsOnboardingProcessing] = useState(false);
  const [onboardingProgress, setOnboardingProgress] = useState<FileProgress[]>([]);
  const [isDark, setIsDark] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [devTriggerError, setDevTriggerError] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadChatMessages());
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [pendingAutoMessage, setPendingAutoMessage] = useState<string | null>(null);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const hasShownOnboardingRef = useRef(false);
  const [devUpdateOverride, setDevUpdateOverride] = useState<UpdateStatus | null>(null);
  const updater = useElectronUpdater(devUpdateOverride);

  // Compute effective demo mode early (dev override takes precedence)
  const effectiveIsDemo = resolveDemoMode(devDemoOverride, state.isDemo);

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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const currentId = state.selectedYear === "summary" ? "summary" : String(state.selectedYear);
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
                p.id === pending.id ? { ...p, year: extractedYear, status: "parsing" } : p,
              ),
            );
          } catch (err) {
            console.error("Year extraction failed:", err);
            setPendingUploads((prev) =>
              prev.map((p) => (p.id === pending.id ? { ...p, status: "parsing" } : p)),
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

    // Check if this is the last year before updating state
    const isLastYear = Object.keys(state.returns).length === 1;

    setState((s) => {
      const newReturns = { ...s.returns };
      delete newReturns[year];

      if (isLastYear) {
        // Last year deleted - reset to sample data state
        return {
          ...s,
          returns: sampleReturns,
          selectedYear: "summary",
          hasUserData: false,
        };
      }

      const newSelection =
        s.selectedYear === year ? getDefaultSelection(newReturns) : s.selectedYear;
      return {
        ...s,
        returns: newReturns,
        selectedYear: newSelection,
      };
    });

    // Re-open onboarding if we just deleted the last year
    if (isLastYear) {
      setOpenModal("onboarding");
    }
  }

  if (state.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-(--color-text-muted)">Loading...</span>
      </div>
    );
  }

  function getSelectedId(): string {
    if (typeof state.selectedYear === "string" && state.selectedYear.startsWith("pending:")) {
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
    // Calculate selectedYear for StatsHeader (always "summary" or a number)
    const statsSelectedYear: "summary" | number =
      typeof state.selectedYear === "number" ? state.selectedYear : "summary";

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
      hasStoredKey: state.hasStoredKey,
      returns: effectiveReturns,
      selectedYear: statsSelectedYear,
    };

    if (selectedPendingUpload) {
      return <MainPanel view="loading" pendingUpload={selectedPendingUpload} {...commonProps} />;
    }
    if (state.selectedYear === "summary") {
      return <MainPanel view="summary" {...commonProps} />;
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
    return <MainPanel view="summary" {...commonProps} />;
  }

  // Find pending upload if selected
  const selectedPendingUpload =
    typeof state.selectedYear === "string" && state.selectedYear.startsWith("pending:")
      ? pendingUploads.find((p) => `pending:${p.id}` === state.selectedYear)
      : null;

  // Show onboarding dialog for new users (unless dismissed) or when manually opened
  // Processing takes precedence - keep dialog open while processing
  // In demo mode, don't auto-show - let users browse sample data first
  const showOnboarding =
    isOnboardingProcessing ||
    openModal === "onboarding" ||
    (!effectiveIsDemo && !onboardingDismissed && !state.hasStoredKey && !state.hasUserData);

  // Skip open animation only on first automatic show (not manual reopen)
  const skipOnboardingAnimation =
    showOnboarding && !hasShownOnboardingRef.current && openModal !== "onboarding";
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

  async function handleOnboardingUpload(files: FileWithId[], apiKey: string) {
    setIsOnboardingProcessing(true);
    const existingYears = Object.keys(state.returns).map(Number);

    // Initialize progress using the same IDs from SetupDialog
    const progress: FileProgress[] = files.map((f) => ({
      id: f.id,
      filename: f.file.name,
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
      const fileWithId = files[i]!;
      const file = fileWithId.file;
      const id = fileWithId.id;

      setOnboardingProgress((p) => p.map((f) => (f.id === id ? { ...f, status: "parsing" } : f)));

      try {
        const taxReturn = await processUpload(file, apiKey);
        uploadedYears.push(taxReturn.year);
        setOnboardingProgress((p) =>
          p.map((f) => (f.id === id ? { ...f, status: "complete", year: taxReturn.year } : f)),
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
    const nav = getPostUploadNavigation(existingYears, uploadedYears, files.length);
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

      {effectiveIsDemo ? (
        <DemoDialog
          isOpen={showOnboarding}
          onClose={handleOnboardingClose}
          skipOpenAnimation={skipOnboardingAnimation}
        />
      ) : (
        <SetupDialog
          isOpen={showOnboarding}
          onUpload={handleOnboardingUpload}
          onClose={handleOnboardingClose}
          isProcessing={isOnboardingProcessing}
          fileProgress={onboardingProgress}
          hasStoredKey={state.hasStoredKey}
          existingYears={state.hasUserData ? Object.keys(state.returns).map(Number) : []}
          skipOpenAnimation={skipOnboardingAnimation}
        />
      )}

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

      {/* Demo island - show in demo mode when dialog is closed */}
      {effectiveIsDemo && !showOnboarding && (
        <>
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-90 h-96 bg-linear-to-t from-white to-transparent md:h-128 dark:from-black" />
          <button
            onClick={() => setOpenModal("onboarding")}
            className="dark:shadow-contrast fixed right-8 bottom-8 left-8 z-100 flex cursor-pointer flex-col gap-3 rounded-2xl bg-black p-4 text-white shadow-md ring-[0.5px] ring-black/10 md:max-w-lg md:p-6 dark:bg-neutral-900"
          >
            <div className="mb-2 flex flex-col items-start justify-start text-left text-lg">
              <span className="font-semibold text-white">Tax UI</span>
              <span className="font-medium opacity-70">
                Visualize and chat with your tax returns.
              </span>
            </div>
            <span className="self-start rounded-lg bg-(--color-brand) px-3 py-1.5 text-base font-semibold text-neutral-900 text-white">
              Get started
            </span>
          </button>
        </>
      )}

      {updater && (
        <div className="get-started-pill dark:shadow-contrast fixed right-6 bottom-6 z-50 flex h-10 items-center gap-2 rounded-full bg-black pr-1.5 pl-4 text-sm text-white shadow-lg transition-all duration-300 ease-out dark:bg-zinc-800">
          {updater.status === "available" && (
            <>
              <span className="whitespace-nowrap">v{updater.version} available</span>
              <button
                onClick={updater.download}
                className="cursor-pointer rounded-full bg-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-blue-600"
              >
                Update
              </button>
            </>
          )}
          {updater.status === "downloading" && (
            <span className="pr-2.5 whitespace-nowrap tabular-nums">
              Downloading {updater.progress}%
            </span>
          )}
          {updater.status === "ready" && (
            <>
              <span className="whitespace-nowrap">Update ready</span>
              <button
                onClick={updater.install}
                className="cursor-pointer rounded-full bg-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-blue-600"
              >
                Restart
              </button>
            </>
          )}
        </div>
      )}

      {state.isDev && (
        <DevTools
          devDemoOverride={devDemoOverride}
          onDemoOverrideChange={setDevDemoOverride}
          onTriggerError={() => setDevTriggerError(true)}
          devUpdateOverride={devUpdateOverride}
          onUpdateOverrideChange={setDevUpdateOverride}
        />
      )}
    </div>
  );
}
