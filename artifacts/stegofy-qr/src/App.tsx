import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import { AuthProvider } from "@/app/context/AuthContext";
import { QRProvider } from "@/app/context/QRContext";
import { AppRouter } from "@/app/AppRouter";
import { PublicProfileScreen } from "@/app/screens/scan/PublicProfileScreen";

const queryClient = new QueryClient();

const LANDING_PATHS = ["/", "/products", "/about", "/pricing", "/faq"];

// Simple hook that reads window.location.pathname and updates on popstate / pushState
function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);

    // Patch pushState / replaceState so SPA navigation triggers re-render
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    history.pushState = (...args) => {
      origPush(...args);
      setPathname(window.location.pathname);
    };
    history.replaceState = (...args) => {
      origReplace(...args);
      setPathname(window.location.pathname);
    };

    return () => {
      window.removeEventListener("popstate", onPop);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  return pathname;
}

function Router() {
  const pathname = usePathname();

  if (LANDING_PATHS.includes(pathname)) {
    return <LandingPage />;
  }

  if (pathname.startsWith("/app")) {
    return <AppRouter />;
  }

  return <NotFound />;
}

function App() {
  // /qr/* pages are fully public — render outside AuthProvider / QRProvider.
  // QR tags are always opened directly via scan (fresh page load), so a
  // static pathname check at mount time is correct and sufficient.
  if (window.location.pathname.startsWith("/qr/")) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <PublicProfileScreen />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <QRProvider>
            <Router />
            <Toaster />
          </QRProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
