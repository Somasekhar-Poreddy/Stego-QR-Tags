import { createContext, useContext, useState, ReactNode } from "react";

export type QRType = "pet" | "vehicle" | "child" | "medical" | "luggage" | "wallet" | "home" | "event" | "business";

export interface QRProfile {
  id: string;
  name: string;
  type: QRType;
  status: "active" | "inactive";
  photo?: string;
  primaryContact: string;
  emergencyContact?: string;
  notes?: string;
  privacyMode: "show" | "mask" | "whatsapp" | "emergency";
  scans: number;
  createdAt: string;
}

interface QRContextType {
  profiles: QRProfile[];
  addProfile: (profile: Omit<QRProfile, "id" | "scans" | "createdAt">) => QRProfile;
  updateProfile: (id: string, updates: Partial<QRProfile>) => void;
  deleteProfile: (id: string) => void;
}

const QRContext = createContext<QRContextType | null>(null);

const MOCK_PROFILES: QRProfile[] = [
  {
    id: "1",
    name: "Bruno (Labrador)",
    type: "pet",
    status: "active",
    primaryContact: "+91 98*** ***12",
    privacyMode: "mask",
    scans: 3,
    createdAt: "2026-03-10",
  },
  {
    id: "2",
    name: "Honda City · MH01AB1234",
    type: "vehicle",
    status: "active",
    primaryContact: "+91 98*** ***12",
    privacyMode: "mask",
    scans: 7,
    createdAt: "2026-03-01",
  },
];

export function QRProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<QRProfile[]>(MOCK_PROFILES);

  const addProfile = (profile: Omit<QRProfile, "id" | "scans" | "createdAt">) => {
    const newProfile: QRProfile = {
      ...profile,
      id: Date.now().toString(),
      scans: 0,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setProfiles((prev) => [newProfile, ...prev]);
    return newProfile;
  };

  const updateProfile = (id: string, updates: Partial<QRProfile>) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const deleteProfile = (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <QRContext.Provider value={{ profiles, addProfile, updateProfile, deleteProfile }}>
      {children}
    </QRContext.Provider>
  );
}

export function useQR() {
  const ctx = useContext(QRContext);
  if (!ctx) throw new Error("useQR must be used within QRProvider");
  return ctx;
}
