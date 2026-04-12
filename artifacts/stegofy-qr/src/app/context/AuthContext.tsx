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
  urlError: string | null;
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

// ─── Module-level recovery flags ──────────────────────────────────────────────
// These run the instant this module is imported — before React renders and before
// Supabase's async initialize() can clear the URL hash or query string.
//
// TWO flows must be handled:
//   • Implicit flow  → Supabase puts #type=recovery&access_token=...  in the hash
//   • PKCE flow      → Supabase puts ?code=<one-time-code>  in the query string
//                      (no "type=recovery" visible in the URL)
//
// For PKCE we cannot know it's a recovery from the URL alone. Instead we:
//   1. Set _codeParamPending = true so getSession() doesn't auto-login
//   2. Briefly defer the SIGNED_IN handler so PASSWORD_RECOVERY can arrive first

let _recoveryPending = false;   // implicit flow: #type=recovery detected
let _codeParamPending = false;  // PKCE flow:     ?code= detected (may be recovery)
let _urlError: string | null = null; // e.g. otp_expired from a bad/stale reset link

try {
  const _h = new URLSearchParams(window.location.hash.slice(1));
  const _q = new URLSearchParams(window.location.search);

  // Implicit flow recovery (#type=recovery in hash)
  if (_h.get("type") === "recovery" || _q.get("type") === "recovery") {
    _recoveryPending = true;
  }
  // Our own marker — added to redirectTo so it survives both PKCE and implicit redirects
  if (_q.has("stego_reset")) {
    _recoveryPending = true;
  }
  // PKCE flow — ?code= present but no type marker yet; wait for auth events
  if (_q.has("code") && !_recoveryPending) {
    _codeParamPending = true;
  }
  // Supabase error in hash (e.g. expired / already-used reset link)
  if (_h.get("error")) {
    const code = _h.get("error_code") || _h.get("error") || "unknown";
    const desc = _h.get("error_description")?.replace(/\+/g, " ") || "The link is invalid or has expired.";
    _urlError = code === "otp_expired"
      ? "expired"
      : desc;
  }
} catch {}

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

export function AuthProvider({ children }: { children: ReactNode }) {
  // _recoveryPending is the module-level flag set at import time — safe to use directly.
  const [step, _setStep] = useState<AuthStep>(_recoveryPending ? "reset-password" : "login");
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [urlError] = useState<string | null>(_urlError);
  const [loading, setLoading] = useState(true);

  const otpSignupInProgress = useRef(false);
  // Mirror the module-level flag into a ref so event handlers can read it synchronously.
  // Initialized ONCE from _recoveryPending (not from URL detection which may be stale).
  const passwordRecoveryInProgress = useRef(_recoveryPending);
  // Stores the user id before sign-out so the logout event can be logged
  const prevUserIdRef = useRef<string | null>(null);

  // Wrap setStep so navigating back to login always clears all in-progress flags
  const setStep = (s: AuthStep) => {
    if (s === "login") {
      otpSignupInProgress.current = false;
      passwordRecoveryInProgress.current = false;
      _recoveryPending = false;
      _codeParamPending = false;
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
        // Implicit recovery (#type=recovery in hash) — show reset screen immediately.
        if (passwordRecoveryInProgress.current) {
          clearTimeout(loadingTimeout);
          if (mounted) { _setStep("reset-password"); setLoading(false); }
          return;
        }
        // PKCE flow: a ?code= param is in the URL. Supabase is exchanging it for a session
        // in the background. Do NOT auto-login yet — wait for auth events (SIGNED_IN /
        // PASSWORD_RECOVERY) to tell us whether this is a recovery or a normal sign-in.
        if (_codeParamPending) {
          clearTimeout(loadingTimeout);
          if (mounted) setLoading(false);
          return;
        }
        if (session?.user && !otpSignupInProgress.current) {
          const built = await fetchAndBuildUser(session.user);
          if (mounted) {
            prevUserIdRef.current = session.user.id;
            setUser(built); setStep("app");
          }
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

      // PASSWORD_RECOVERY fires for BOTH implicit and PKCE flows.
      // In PKCE, it arrives just after SIGNED_IN — this handler must win.
      if (event === "PASSWORD_RECOVERY") {
        _recoveryPending = true;
        _codeParamPending = false;
        passwordRecoveryInProgress.current = true;
        if (mounted) { setLoading(false); _setStep("reset-password"); }
        return;
      }

      if (event === "SIGNED_IN" && session?.user) {
        // Always skip if we already know this is recovery (implicit flow).
        if (passwordRecoveryInProgress.current) return;

        // PKCE flow: SIGNED_IN fires *before* PASSWORD_RECOVERY. Wait up to 400 ms
        // so PASSWORD_RECOVERY has a chance to arrive and set the flag above.
        // If it does, we bail out. If not (normal sign-in/email confirm), we navigate.
        if (_codeParamPending) {
          await new Promise<void>((r) => setTimeout(r, 400));
          _codeParamPending = false;
          if (passwordRecoveryInProgress.current) return; // recovery won — stay on reset screen
        }

        try {
          const built = await fetchAndBuildUser(session.user);
          if (mounted) {
            prevUserIdRef.current = session.user.id;
            setUser(built); setStep("app"); setLoading(false);
          }
        } catch {
          if (mounted) setLoading(false);
        }

        // Fire-and-forget: log login event (never blocks auth flow)
        supabase.from("user_activity_logs").insert({
          user_id: session.user.id,
          event_type: "login",
          metadata: {
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
          },
        });
      }

      if (event === "SIGNED_OUT") {
        // Don't navigate to login if we are in the recovery flow
        if (passwordRecoveryInProgress.current) return;
        // Fire-and-forget: log logout event using the stored ref id
        if (prevUserIdRef.current) {
          supabase.from("user_activity_logs").insert({
            user_id: prevUserIdRef.current,
            event_type: "logout",
            metadata: {
              user_agent: navigator.userAgent,
              platform: navigator.platform,
              language: navigator.language,
            },
          });
          prevUserIdRef.current = null;
        }
        setUser(null); setStep("login"); setLoading(false);
      }

      // USER_UPDATED fires during recovery session creation AND after password update.
      // Do NOT clear passwordRecoveryInProgress here — only setStep("login") clears it.
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
    // Check if the email is registered before asking Supabase to send a link.
    // Supabase never reveals whether an address exists — we enforce it ourselves.
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id")
      .ilike("email", email.trim())
      .maybeSingle();

    if (!profile) {
      return "No account found with that email address. Please check the email or create a new account.";
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/app?stego_reset=1`,
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
        step, user, authError, urlError, loading,
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
