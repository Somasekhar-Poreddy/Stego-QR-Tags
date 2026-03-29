import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type AuthStep =
  | "login"
  | "otp"
  | "signup"
  | "email-verify"
  | "onboarding"
  | "app";

export interface User {
  id?: string;
  phone?: string;
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

  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    isFirstTime: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<AuthStep>("login");
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Ref to suppress auto-navigation when user is mid OTP signup form
  const otpSignupInProgress = useRef(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user && !otpSignupInProgress.current) {
        const built = await fetchAndBuildUser(session.user);
        if (mounted) {
          setUser(built);
          setStep("app");
        }
      }
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Don't auto-navigate while user is completing the OTP signup form
      if (otpSignupInProgress.current) return;

      if (event === "SIGNED_IN" && session?.user) {
        const built = await fetchAndBuildUser(session.user);
        setUser(built);
        setStep("app");
        setLoading(false);
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setStep("login");
        setLoading(false);
      }

      if (event === "USER_UPDATED" && session?.user) {
        const built = await fetchAndBuildUser(session.user);
        setUser(built);
        setStep("app");
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
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

  // Standard signup (no OTP email verification — Supabase sends confirmation email)
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
        if (profileError) {
          console.warn("Direct profile insert skipped (trigger will handle it):", profileError.message);
        }
      }

      setUser({
        id: authData.user?.id,
        email: data.email,
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

  // Called from SignUpScreen just before OTP is verified — suppresses auto-nav
  const beginOtpVerification = () => {
    otpSignupInProgress.current = true;
  };

  // Called after OTP is verified + form is submitted — user already has a session from OTP
  const completeOtpSignup = async (data: SignUpData) => {
    setAuthError(null);
    try {
      // User is already signed in via OTP — set their password and metadata
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

      // Save full profile to user_profiles table
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
    await supabase.auth.signOut();
    setUser(null);
    setStep("login");
  };

  return (
    <AuthContext.Provider
      value={{
        step,
        user,
        authError,
        loading,
        setStep,
        setUser,
        setAuthError,
        signInWithEmail,
        signUpWithEmail,
        beginOtpVerification,
        completeOtpSignup,
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
