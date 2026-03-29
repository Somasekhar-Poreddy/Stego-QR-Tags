import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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
  logout: () => void;
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

  // ── Step 5: Restore session on app load ──────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // Check for an existing session (user refreshed the page / reopened the app)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        const built = await fetchAndBuildUser(session.user);
        if (mounted) {
          setUser(built);
          setStep("app");
        }
      }
      if (mounted) setLoading(false);
    });

    // Listen for future auth events (email confirmation redirect, logout, etc.)
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

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

      // Email confirmed — user clicks link and lands back in app
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

  // ── Step 3: Sign in — fetch full profile from user_profiles ──────────────
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

  // ── Step 2: Sign up — save user data to user_profiles ───────────────────
  const signUpWithEmail = async (data: SignUpData) => {
    setAuthError(null);
    try {
      // Create auth user; metadata goes into auth.users.raw_user_meta_data
      // and the DB trigger auto-inserts a row into user_profiles
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

      // Fallback direct insert — works when email confirmation is disabled.
      // When confirmation is ON the trigger handles it; conflict is ignored.
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

  const logout = async () => {
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
