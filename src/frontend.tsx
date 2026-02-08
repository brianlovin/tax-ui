import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { applyElectronDocumentAttributes } from "./lib/electron";

function start() {
  applyElectronDocumentAttributes();
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <ErrorBoundary name="Application">
      <App />
    </ErrorBoundary>
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
