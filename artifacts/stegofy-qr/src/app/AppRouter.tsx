import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { AppLayout } from "@/app/AppLayout";
import { useAuth } from "@/app/context/AuthContext";

import { LoginScreen } from "@/app/screens/auth/LoginScreen";
import { SignUpScreen } from "@/app/screens/auth/SignUpScreen";
import { EmailVerifyScreen } from "@/app/screens/auth/EmailVerifyScreen";
import { OnboardingScreen } from "@/app/screens/onboarding/OnboardingScreen";
import { HomeScreen } from "@/app/screens/home/HomeScreen";
import { MyQRScreen } from "@/app/screens/qr/MyQRScreen";
import { CreateQRScreen } from "@/app/screens/qr/CreateQRScreen";
import { QRSuccessScreen } from "@/app/screens/qr/QRSuccessScreen";
import { ScanScreen } from "@/app/screens/scan/ScanScreen";
import { PublicProfileScreen } from "@/app/screens/scan/PublicProfileScreen";
import { ShopScreen } from "@/app/screens/shop/ShopScreen";
import { ProfileScreen } from "@/app/screens/profile/ProfileScreen";

export function AppRouter() {
  const { step, setStep } = useAuth();
  const [location] = useLocation();

  // When landing directly on /app/signup via URL (e.g. from Navbar "Sign Up"),
  // advance the step so the signup form shows immediately
  useEffect(() => {
    if (location === "/app/signup" && (step === "login" || step === "otp")) {
      setStep("signup");
    }
  }, [location]);

  // Auth gate — step drives which screen to show
  if (step === "login" || step === "otp") return <LoginScreen />;
  if (step === "signup") return <SignUpScreen />;
  if (step === "email-verify") return <EmailVerifyScreen />;
  if (step === "onboarding") return <OnboardingScreen />;

  // Authenticated app
  return (
    <AppLayout>
      <Switch>
        <Route path="/app" component={HomeScreen} />
        <Route path="/app/login" component={HomeScreen} />
        <Route path="/app/signup" component={HomeScreen} />
        <Route path="/app/qr" component={MyQRScreen} />
        <Route path="/app/qr/create" component={CreateQRScreen} />
        <Route path="/app/qr/success" component={QRSuccessScreen} />
        <Route path="/app/scan" component={ScanScreen} />
        <Route path="/app/scan/profile" component={PublicProfileScreen} />
        <Route path="/app/shop" component={ShopScreen} />
        <Route path="/app/profile" component={ProfileScreen} />
        <Route component={HomeScreen} />
      </Switch>
    </AppLayout>
  );
}
