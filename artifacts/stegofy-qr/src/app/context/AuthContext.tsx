import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type AuthStep =
  | "login"
  | "otp"
  | "signup"
  | "email-verify"
  | "onboarding"
  | "reset-password"
  | "app";

export interface User {
  id?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  isFirstTime: boolean;
}

export interface SignUpData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  mobile: string;
  ageGroup: string;
  gender: string;
}

interface AuthContextType {
  step: AuthStep;
  user: User | null;
  authError: string | null;
  loading: boolean;
  setStep: (step: AuthStep) => void;
  setUser: (user: User) => void;
  setAuthError: (msg: string | null) => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (data: SignUpData) => Promise<void>;
  beginOtpVerification: () => void;
  completeOtpSignup: (data: SignUpData) => Promise<void>;
  sendLoginOtp: (email: string) => Promise<string | null>;
  verifyLoginOtp: (email: string, token: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchAndBuildUser(supabaseUser: any): Promise<User> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", supabaseUser.id)
    .single();

  const firstName =
    profile?.first_name ||
    supabaseUser.user_metadata?.first_name ||
    supabaseUser.email?.split("@")[0] ||
    "User";
  const lastName = profile?.last_name || supabaseUser.user_metadata?.last_name || "";
  const mobile = profile?.mobile || supabaseUser.user_metadata?.mobile || null;

  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    firstName,
    lastName,
    mobile,
    name: `${firstName} ${lastName}`.trim(),
    isFirstTime: false,
  };
}

// Synchronously detect password recovery from URL before any auth events fire.
// Checks both hash fragment (implicit flow) and query params (PKCE flow).
function detectInitialStep(): AuthStep {
  try {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (hashParams.get("type") === "recovery") return "reset-password";
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("type") === "recovery") return "reset-password";
  } catch {}
  return "login";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [step, _setStep] = useState<AuthStep>(detectInitialStep);
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const otpSignupInProgress = useRef(false);
  // Track if we are in a password recovery flow so SIGNED_IN doesn't override it
  const passwordRecoveryInProgress = useRef(detectInitialStep() === "reset-password");

  // Wrap setStep so navigating back to login always clears the OTP signup flag
  const setStep = (s: AuthStep) => {
    if (s === "login") {
      otpSignupInProgress.current = false;
      passwordRecoveryInProgress.current = false;
    }
    _setStep(s);
  };

  useEffect(() => {
    let mounted = true;

    // Hard timeout: never stay stuck on loading more than 5 seconds
    const loadingTimeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      try {
        // If we detected a recovery token in the URL, sign out any existing session
        // and show the reset screen — never auto-login during a password reset flow.
        if (passwordRecoveryInProgress.current) {
          if (session?.user) {
            // Sign out the existing session so it doesn't interfere with the recovery session
            await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          }
          clearTimeout(loadingTimeout);
          if (mounted) { _setStep("reset-password"); setLoading(false); }
          return;
        }
        if (session?.user && !otpSignupInProgress.current) {
          const built = await fetchAndBuildUser(session.user);
          if (mounted) { setUser(built); setStep("app"); }
        }
      } catch (err) {
        console.warn("Session restore failed:", err);
      } finally {
        clearTimeout(loadingTimeout);
        if (mounted) setLoading(false);
      }
    }).catch(() => {
      clearTimeout(loadingTimeout);
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (otpSignupInProgress.current) return;

      if (event === "PASSWORD_RECOVERY") {
        passwordRecoveryInProgress.current = true;
        if (mounted) { setLoading(false); _setStep("reset-password"); }
        return;
      }
      // Don't let SIGNED_IN override the reset-password screen
      if (event === "SIGNED_IN" && session?.user) {
        if (passwordRecoveryInProgress.current) return;
        try {
          const built = await fetchAndBuildUser(session.user);
          if (mounted) { setUser(built); setStep("app"); setLoading(false); }
        } catch {
          if (mounted) setLoading(false);
        }
      }
      if (event === "SIGNED_OUT") {
        // Don't navigate to login if we forced sign-out as part of the recovery flow
        if (passwordRecoveryInProgress.current) return;
        setUser(null); setStep("login"); setLoading(false);
      }
      // USER_UPDATED fires both during recovery session creation AND after password update.
      // Do NOT clear passwordRecoveryInProgress here — that flag is only cleared by
      // setStep("login") when the user taps "Back to Sign In" on the success screen.
      if (event === "USER_UPDATED") {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  // ── Password login ────────────────────────────────────────────────────────
  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const built = await fetchAndBuildUser(data.user);
      setUser(built);
      setStep("app");
    } catch (err: any) {
      setAuthError(err.message || "Sign in failed. Please try again.");
    }
  };

  // ── OTP login — Step 1: send code ────────────────────────────────────────
  const sendLoginOtp = async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    return error ? (error.message || "Could not send OTP. Please try again.") : null;
  };

  // ── OTP login — Step 2: verify code ─────────────────────────────────────
  const verifyLoginOtp = async (email: string, token: string) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error) throw error;
      if (data.user) {
        const built = await fetchAndBuildUser(data.user);
        setUser(built);
        setStep("app");
      }
    } catch (err: any) {
      setAuthError(err.message || "Invalid or expired code. Try again.");
    }
  };

  // ── Forgot password: send reset email ────────────────────────────────────
  const sendPasswordReset = async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/app`,
    });
    return error ? (error.message || "Could not send reset email. Try again.") : null;
  };

  // ── Standard signup ───────────────────────────────────────────────────────
  const signUpWithEmail = async (data: SignUpData) => {
    setAuthError(null);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            mobile: data.mobile,
            age_group: data.ageGroup,
            gender: data.gender,
          },
        },
      });
      if (signUpError) throw signUpError;

      if (authData.user) {
        const { error: profileError } = await supabase.from("user_profiles").insert({
          id: authData.user.id,
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          mobile: data.mobile || null,
          age_group: data.ageGroup || null,
          gender: data.gender || null,
        });
        if (profileError) console.warn("Profile insert skipped:", profileError.message);
      }

      setUser({
        id: authData.user?.id,
        email: data.email,
        mobile: data.mobile || undefined,
        name: `${data.firstName} ${data.lastName}`.trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        isFirstTime: true,
      });
      setStep("email-verify");
    } catch (err: any) {
      setAuthError(err.message || "Sign up failed. Please try again.");
    }
  };

  const beginOtpVerification = () => { otpSignupInProgress.current = true; };

  const completeOtpSignup = async (data: SignUpData) => {
    setAuthError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          mobile: data.mobile,
          age_group: data.ageGroup,
          gender: data.gender,
        },
      });
      if (updateError) throw updateError;

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await supabase.from("user_profiles").upsert({
          id: currentUser.id,
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          mobile: data.mobile || null,
          age_group: data.ageGroup || null,
          gender: data.gender || null,
        });
        setUser({
          id: currentUser.id,
          email: currentUser.email,
          mobile: data.mobile || undefined,
          name: `${data.firstName} ${data.lastName}`.trim(),
          firstName: data.firstName,
          lastName: data.lastName,
          isFirstTime: true,
        });
      }
      otpSignupInProgress.current = false;
      setStep("app");
    } catch (err: any) {
      otpSignupInProgress.current = false;
      setAuthError(err.message || "Sign up failed. Please try again.");
    }
  };

  const logout = async () => {
    otpSignupInProgress.current = false;
    passwordRecoveryInProgress.current = false;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Sign out error:", e);
    }
    setUser(null);
    setStep("login");
  };

  return (
    <AuthContext.Provider
      value={{
        step, user, authError, loading,
        setStep, setUser, setAuthError,
        signInWithEmail, signUpWithEmail,
        beginOtpVerification, completeOtpSignup,
        sendLoginOtp, verifyLoginOtp,
        sendPasswordReset,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
