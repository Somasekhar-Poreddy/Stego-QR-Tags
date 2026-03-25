import { createContext, useContext, useState, ReactNode } from "react";

export type AuthStep = "login" | "otp" | "onboarding" | "app";

export interface User {
  phone: string;
  name: string;
  isFirstTime: boolean;
}

interface AuthContextType {
  step: AuthStep;
  user: User | null;
  setStep: (step: AuthStep) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<AuthStep>("login");
  const [user, setUser] = useState<User | null>(null);

  const logout = () => {
    setUser(null);
    setStep("login");
  };

  return (
    <AuthContext.Provider value={{ step, user, setStep, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
