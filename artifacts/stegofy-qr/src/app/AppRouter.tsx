import { Switch, Route, useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { AppLayout } from "@/app/AppLayout";
import { useAuth } from "@/app/context/AuthContext";
import { useQR } from "@/app/context/QRContext";
import { QrCode } from "lucide-react";

import { LoginScreen } from "@/app/screens/auth/LoginScreen";
import { SignUpScreen } from "@/app/screens/auth/SignUpScreen";
import { EmailVerifyScreen } from "@/app/screens/auth/EmailVerifyScreen";
import { ResetPasswordScreen } from "@/app/screens/auth/ResetPasswordScreen";
import { OnboardingScreen } from "@/app/screens/onboarding/OnboardingScreen";
import { HomeScreen } from "@/app/screens/home/HomeScreen";
import { MyQRScreen } from "@/app/screens/qr/MyQRScreen";
import { CreateQRScreen } from "@/app/screens/qr/CreateQRScreen";
import { QRSuccessScreen } from "@/app/screens/qr/QRSuccessScreen";
import { ScanScreen } from "@/app/screens/scan/ScanScreen";
import { PublicProfileScreen } from "@/app/screens/scan/PublicProfileScreen";
import { ShopScreen } from "@/app/screens/shop/ShopScreen";
import { ProfileScreen } from "@/app/screens/profile/ProfileScreen";

// Simple container for screens that don't need bottom nav (e.g. unauthenticated Create QR)
function PlainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-lg mx-auto relative">
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function SessionLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-violet-600 gap-4">
      <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
        <QrCode className="w-8 h-8 text-white" />
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 bg-white rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function AppRouter() {
  const { step, setStep, user, loading } = useAuth();
  const { loadUserProfiles } = useQR();
  const [location] = useLocation();
  const loadedForRef = useRef<string | null>(null);

  // When landing directly on /app/signup via URL (e.g. from Navbar "Sign Up"),
  // advance the step so the signup form shows immediately
  useEffect(() => {
    if (location === "/app/signup" && (step === "login" || step === "otp")) {
      setStep("signup");
    }
  }, [location]);

  // Load QR profiles from Supabase once when user becomes authenticated.
  // Guard with loadedForRef so we only fire once per user session, not on every render.
  useEffect(() => {
    if (step === "app" && user?.id && loadedForRef.current !== user.id) {
      loadedForRef.current = user.id;
      loadUserProfiles(user.id);
    }
    // Reset when user logs out so next login re-fetches
    if (step === "login") {
      loadedForRef.current = null;
    }
  }, [step, user?.id]);

  // Create QR and Success flows are accessible without authentication
  // so users can generate a QR immediately before being asked to sign up
  if (location === "/app/qr/create" || location === "/app/qr/success") {
    if (step === "app") {
      return (
        <AppLayout>
          {location === "/app/qr/create" ? <CreateQRScreen /> : <QRSuccessScreen />}
        </AppLayout>
      );
    }
    return (
      <PlainLayout>
        {location === "/app/qr/create" ? <CreateQRScreen /> : <QRSuccessScreen />}
      </PlainLayout>
    );
  }

  if (loading) return <SessionLoader />;

  // Auth gate — step drives which screen to show
  if (step === "login" || step === "otp") return <LoginScreen />;
  if (step === "signup") return <SignUpScreen />;
  if (step === "email-verify") return <EmailVerifyScreen />;
  if (step === "reset-password") return <ResetPasswordScreen />;
  if (step === "onboarding") return <OnboardingScreen />;

  // Authenticated app
  return (
    <AppLayout>
      <Switch>
        <Route path="/app/qr" component={MyQRScreen} />
        <Route path="/app/scan/profile" component={PublicProfileScreen} />
        <Route path="/app/scan" component={ScanScreen} />
        <Route path="/app/shop" component={ShopScreen} />
        <Route path="/app/profile" component={ProfileScreen} />
        <Route component={HomeScreen} />
      </Switch>
    </AppLayout>
  );
}
