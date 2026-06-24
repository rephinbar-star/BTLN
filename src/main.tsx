import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initAnalytics } from "@/lib/analytics";

// Initialize PostHog as early as possible. Internally respects consent:
// non-EU visitors are opted-in by default; EU visitors stay opted-out
// until the consent banner is accepted.
initAnalytics();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);
