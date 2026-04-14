import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("SW registration failed:", err));
  });
}

// Force unregister any OLD stale service workers that may be caching Supabase responses
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister().then(() => {
        console.log("Old SW unregistered — re-registering clean version");
      });
    }
    // Re-register the clean version after clearing old ones
    setTimeout(() => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("SW re-registration failed:", err));
    }, 500);
  });
}
