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

let _recoveryPending = false;
let _codeParamPending = false;
let _urlError: string | null = null;

try {
  const _h = new URLSearchParams(window.location.hash.slice(1));
  const _q = new URLSearchParams(window.location.search);

  if (_h.get("type") === "recovery" || _q.get("type") === "recovery") {
    _recoveryPending = true;
  }
  if (_q.has("stego_reset")) {
    _recoveryPending = true;
  }
  if (_q.has("code") && !_recoveryPending) {
    _codeParamPending = true;
  }
  if (_h.get("error")) {
    const code = _h.get("error_code") || _h.get("error") || "unknown";
    const desc = _h.get("error_description")?.replace(/\+/g, " ") || "The link is invalid or has expired.";
    _urlError = code === "otp_expired" ? "expired" : desc;
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
  const [step, _setStep] = useState<AuthStep>(_recoveryPending ? "reset-password" : "login");
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [urlError] = useState<string | null>(_urlError);
  const [loading, setLoading] = useState(true);

  const otpSignupInProgress = useRef(false);
  const passwordRecoveryInProgress = useRef(_recoveryPending);
  const prevUserIdRef = useRef<string | null>(null);

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

    const loadingTimeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 10000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      try {
        if (passwordRecoveryInProgress.current) {
          clearTimeout(loadingTimeout);
          if (mounted) {
            _setStep("reset-password");
            setLoading(false);
          }
          return;
        }

        if (_codeParamPending) {
          clearTimeout(loadingTimeout);
          if (mounted) setLoading(false);
          return;
        }

        if (session?.user && !otpSignupInProgress.current) {
          const built = await fetchAndBuildUser(session.user);
          if (mounted) {
            prevUserIdRef.current = session.user.id;
            setUser(built);
            setStep("app");
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

      if (event === "PASSWORD_RECOVERY") {
        _recoveryPending = true;
        _codeParamPending = false;
        passwordRecoveryInProgress.current = true;
        if (mounted) {
          setLoading(false);
          _setStep("reset-password");
        }
        return;
      }

      if (event === "SIGNED_IN" && session?.user) {
        if (passwordRecoveryInProgress.current) return;

        if (_codeParamPending) {
          await new Promise<void>((r) => setTimeout(r, 400));
          _codeParamPending = false;
          if (passwordRecoveryInProgress.current) return;
        }

        try {
          const built = await fetchAndBuildUser(session.user);
          if (mounted) {
            prevUserIdRef.current = session.user.id;
            setUser(built);
            setStep("app");
            setLoading(false);
          }
        } catch {
          if (mounted) setLoading(false);
        }

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
      if (event === "TOKEN_REFRESHED" && session?.user) {
        if (passwordRecoveryInProgress.current) return;
        if (mounted) setLoading(false);
        return;
      }
      if (event === "SIGNED_OUT") {
        if (passwordRecoveryInProgress.current) return;

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
        setUser(null);
        setStep("login");
        setLoading(false);
      }

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

  const sendLoginOtp = async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    return error ? (error.message || "Could not send OTP. Please try again.") : null;
  };

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

  const sendPasswordReset = async (email: string): Promise<string | null> => {
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

  const beginOtpVerification = () => {
    otpSignupInProgress.current = true;
  };

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
        step,
        user,
        authError,
        urlError,
        loading,
        setStep,
        setUser,
        setAuthError,
        signInWithEmail,
        signUpWithEmail,
        beginOtpVerification,
        completeOtpSignup,
        sendLoginOtp,
        verifyLoginOtp,
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