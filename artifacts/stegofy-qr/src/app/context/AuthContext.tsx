import { createContext, useContext, useState, ReactNode } from "react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<AuthStep>("login");
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Fetch full profile from user_profiles table
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      setUser({
        id: data.user.id,
        email: data.user.email,
        name: profile?.first_name || data.user.user_metadata?.first_name || email.split("@")[0],
        firstName: profile?.first_name || data.user.user_metadata?.first_name,
        lastName: profile?.last_name || data.user.user_metadata?.last_name,
        isFirstTime: false,
      });
      setStep("app");
    } catch (err: any) {
      setAuthError(err.message || "Sign in failed. Please try again.");
    }
  };

  const signUpWithEmail = async (data: SignUpData) => {
    setAuthError(null);
    try {
      // Step 1: Create auth user — metadata is stored in auth.users.raw_user_meta_data
      // and the DB trigger will auto-insert into user_profiles
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

      // Step 2: Also attempt a direct insert into user_profiles.
      // This succeeds when email confirmation is disabled (user is immediately active).
      // When email confirmation is ON, the DB trigger fires on auth.users INSERT
      // and handles the insert automatically — so this is a safe fallback.
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

        // Log but don't block — the trigger is the reliable fallback
        if (profileError) {
          console.warn("Direct profile insert skipped (trigger will handle it):", profileError.message);
        }
      }

      setUser({
        id: authData.user?.id,
        email: data.email,
        name: data.firstName,
        firstName: data.firstName,
        lastName: data.lastName,
        isFirstTime: true,
      });
      setStep("email-verify");
    } catch (err: any) {
      setAuthError(err.message || "Sign up failed. Please try again.");
    }
  };

  const logout = () => {
    supabase.auth.signOut();
    setUser(null);
    setStep("login");
  };

  return (
    <AuthContext.Provider
      value={{ step, user, authError, setStep, setUser, setAuthError, signInWithEmail, signUpWithEmail, logout }}
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
