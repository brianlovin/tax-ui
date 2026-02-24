import "./index.css";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

import type { ChatMessage } from "./components/Chat";
import { DemoDialog } from "./components/DemoDialog";
import { DevTools } from "./components/DevTools";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MainPanel } from "./components/MainPanel";
import { ResetDialog } from "./components/ResetDialog";
import { SettingsModal } from "./components/SettingsModal";
import { SetupDialog } from "./components/SetupDialog";
import { UploadModal } from "./components/UploadModal";
import { CountryConfigProvider } from "./context/CountryContext";
import { caReturns, sampleReturns } from "./data/sampleData";
import { isElectron } from "./lib/electron";
import { getDevDemoOverride, isHostedEnvironment, resolveDemoMode } from "./lib/env";
import type { ProviderType } from "./lib/providers/types";
import type { FileProgress, FileWithId, PendingUpload, TaxReturn } from "./lib/schema";
import type { NavItem } from "./lib/types";
import { useIsMobile } from "./lib/useIsMobile";

const Chat = lazy(() => import("./components/Chat").then((m) => ({ default: m.Chat })));

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
  providerType: ProviderType | null;
  selectedYear: SelectedView;
  isLoading: boolean;
  hasUserData: boolean;
  isDemo: boolean;
  isDev: boolean;
}

async function fetchInitialState(): Promise<
  Pick<AppState, "returns" | "hasStoredKey" | "providerType" | "hasUserData" | "isDemo" | "isDev">
> {
  // In production (static hosting), skip API calls and use sample data
  if (isHostedEnvironment()) {
    return {
      hasStoredKey: false,
      providerType: null,
      returns: {},
      hasUserData: false,
      isDemo: true,
      isDev: false,
    };
  }

  const [configRes, returnsRes] = await Promise.all([fetch("/api/config"), fetch("/api/returns")]);
  const { hasKey, providerType, isDemo, isDev } = await configRes.json();
  const returns = await returnsRes.json();
  const hasUserData = Object.keys(returns).length > 0;
  return {
    hasStoredKey: hasKey,
    providerType: providerType ?? null,
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

const SAMPLE_RETURNS_BY_COUNTRY: Record<string, Record<number, TaxReturn>> = {
  US: sampleReturns,
  CA: caReturns,
};

function getSampleReturnsForCountry(country: string): Record<number, TaxReturn> {
  return SAMPLE_RETURNS_BY_COUNTRY[country] ?? sampleReturns;
}

export function App() {
  const [state, setState] = useState<AppState>({
    returns: getSampleReturnsForCountry(localStorage.getItem("tax-ui:country") ?? "US"),
    hasStoredKey: false,
    providerType: null,
    selectedYear: "summary",
    isLoading: true,
    hasUserData: false,
    isDemo: isHostedEnvironment(),
    isDev: false,
  });
  const [devDemoOverride, setDevDemoOverride] = useState<boolean | null>(getDevDemoOverride);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
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
  const isMobile = useIsMobile();
  const [devUpdateOverride, setDevUpdateOverride] = useState<UpdateStatus | null>(null);
  const updater = useElectronUpdater(devUpdateOverride);
  const [country, setCountry] = useState<string>(
    () => localStorage.getItem("tax-ui:country") ?? "US",
  );

  function handleCountryChange(c: string) {
    setCountry(c);
    localStorage.setItem("tax-ui:country", c);
  }

  const toggleChat = useCallback(() => setIsChatOpen((prev) => !prev), []);

  // Compute effective demo mode early (dev override takes precedence)
  const effectiveIsDemo = resolveDemoMode(devDemoOverride, state.isDemo);

  // Hide chat on mobile in demo mode
  const shouldShowChat = !effectiveIsDemo || !isMobile;

  // When demo or no user data, show country-specific sample data; otherwise user's returns
  const effectiveReturns =
    effectiveIsDemo || !state.hasUserData ? getSampleReturnsForCountry(country) : state.returns;
  const navItems = buildNavItems(effectiveReturns);

  // Refs for values used inside submitChatMessage to avoid recreating the callback
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;
  const effectiveReturnsRef = useRef(effectiveReturns);
  effectiveReturnsRef.current = effectiveReturns;

  useEffect(() => {
    fetchInitialState()
      .then(({ returns, hasStoredKey, providerType, hasUserData, isDemo, isDev }) => {
        // Use user data if available, otherwise show sample data for selected country
        const effectiveReturns = hasUserData ? returns : getSampleReturnsForCountry(country);
        setState({
          returns: effectiveReturns,
          hasStoredKey,
          providerType,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- country intentionally excluded: sample selection happens via effectiveReturns on render
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
    localStorage.setItem(CHAT_OPEN_KEY, String(isChatOpen));
  }, [isChatOpen]);

  useEffect(() => {
    saveChatMessages(chatMessages);
  }, [chatMessages]);

  const submitChatMessage = useCallback(
    async (prompt: string) => {
      if (!prompt) return;

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
            history: chatMessagesRef.current,
            returns: effectiveReturnsRef.current,
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
            history: [...chatMessagesRef.current, userMessage, assistantMessage],
            returns: effectiveReturnsRef.current,
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
    },
    [effectiveIsDemo],
  );

  // Auto-submit pending message when chat is ready
  useEffect(() => {
    if (pendingAutoMessage && isChatOpen && !isChatLoading) {
      submitChatMessage(pendingAutoMessage);
      setPendingAutoMessage(null);
    }
  }, [pendingAutoMessage, isChatOpen, isChatLoading, submitChatMessage]);

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

    const { taxReturn, returns }: { taxReturn: TaxReturn; returns: Record<number, TaxReturn> } =
      await res.json();

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
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    setState((s) => ({
      ...s,
      hasStoredKey: true,
      providerType: data.providerType ?? s.providerType,
    }));
  }

  async function handleSaveProviderConfig(config: {
    apiKey?: string;
    providerType?: string;
    baseUrl?: string;
    model?: string;
  }) {
    const res = await fetch("/api/config/key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    setState((s) => ({
      ...s,
      hasStoredKey: true,
      providerType: data.providerType ?? s.providerType,
    }));
  }

  async function handleClearData() {
    const res = await fetch("/api/clear-data", { method: "POST" });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || `HTTP ${res.status}`);
    }
    // Reset to initial state with sample data for selected country
    setState((s) => ({
      returns: getSampleReturnsForCountry(country),
      hasStoredKey: false,
      providerType: null,
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
        // Last year deleted - reset to sample data state for selected country
        return {
          ...s,
          returns: getSampleReturnsForCountry(country),
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
      onToggleChat: toggleChat,
      showChatButton: shouldShowChat,
      navItems,
      selectedId,
      onSelect: handleSelect,
      onOpenStart: () => setOpenModal("onboarding"),
      onOpenSettings: () => setOpenModal("settings"),
      onOpenReset: () => setOpenModal("reset"),
      onDeleteYear: handleDelete,
      isDemo: effectiveIsDemo,
      hasUserData: state.hasUserData,
      hasStoredKey: state.hasStoredKey,
      returns: effectiveReturns,
      selectedYear: statsSelectedYear,
      country,
      onCountryChange: handleCountryChange,
    };

    if (selectedPendingUpload) {
      return (
        <CountryConfigProvider country={country}>
          <MainPanel view="loading" pendingUpload={selectedPendingUpload} {...commonProps} />
        </CountryConfigProvider>
      );
    }
    if (state.selectedYear === "summary") {
      return (
        <CountryConfigProvider country={country}>
          <MainPanel view="summary" {...commonProps} />
        </CountryConfigProvider>
      );
    }
    const receiptData = getReceiptData();
    if (receiptData) {
      return (
        <CountryConfigProvider country={country}>
          <MainPanel
            view="receipt"
            data={receiptData}
            title={String(state.selectedYear)}
            {...commonProps}
          />
        </CountryConfigProvider>
      );
    }
    return (
      <CountryConfigProvider country={country}>
        <MainPanel view="summary" {...commonProps} />
      </CountryConfigProvider>
    );
  }

  // Find pending upload if selected
  const selectedPendingUpload =
    typeof state.selectedYear === "string" && state.selectedYear.startsWith("pending:")
      ? pendingUploads.find((p) => `pending:${p.id}` === state.selectedYear)
      : null;

  // Show onboarding dialog only when explicitly opened or while processing
  const showOnboarding = isOnboardingProcessing || openModal === "onboarding";

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

    try {
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

      // Auto-trigger chat after successful upload
      if (uploadedYears.length > 0) {
        const autoMessage =
          files.length === 1
            ? "Help me understand my year"
            : "Help me understand my history of income and taxes";
        setPendingAutoMessage(autoMessage);
        setIsChatOpen(true);
      }

      // If any files failed, throw so the dialog stays open with an error
      const failedCount = files.length - uploadedYears.length;
      if (failedCount > 0) {
        throw new Error(
          failedCount === files.length
            ? "Failed to process files. Check your API key and try again."
            : `${failedCount} of ${files.length} files failed to process`,
        );
      }

      // All succeeded - close dialog
      setOpenModal(null);
    } finally {
      setIsOnboardingProcessing(false);
      setOnboardingProgress([]);
    }
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
          <Suspense fallback={null}>
            <Chat
              messages={chatMessages}
              isLoading={isChatLoading}
              hasApiKey={state.hasStoredKey}
              isDemo={effectiveIsDemo}
              providerType={state.providerType}
              onSubmit={submitChatMessage}
              onNewChat={handleNewChat}
              onClose={() => setIsChatOpen(false)}
              onConfigureKey={() => setOpenModal("onboarding")}
              followUpSuggestions={followUpSuggestions}
              isLoadingSuggestions={isLoadingSuggestions}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {effectiveIsDemo ? (
        <DemoDialog isOpen={showOnboarding} onClose={() => setOpenModal(null)} />
      ) : (
        <SetupDialog
          isOpen={showOnboarding}
          onUpload={handleOnboardingUpload}
          onSaveProvider={handleSaveProviderConfig}
          onClose={() => setOpenModal(null)}
          isProcessing={isOnboardingProcessing}
          fileProgress={onboardingProgress}
          hasStoredKey={state.hasStoredKey}
          providerType={state.providerType}
          existingYears={state.hasUserData ? Object.keys(state.returns).map(Number) : []}
          country={country}
          onCountryChange={handleCountryChange}
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
        providerType={state.providerType}
        pendingFiles={pendingFiles}
        configureKeyOnly={configureKeyOnly}
      />

      <SettingsModal
        isOpen={openModal === "settings"}
        onClose={() => setOpenModal(null)}
        hasApiKey={state.hasStoredKey}
        providerType={state.providerType}
        onSaveApiKey={handleSaveApiKey}
        onSaveProviderConfig={handleSaveProviderConfig}
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
