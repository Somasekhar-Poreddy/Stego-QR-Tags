import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type QRType = "pet" | "vehicle" | "child" | "medical" | "luggage" | "wallet" | "home" | "event" | "business" | "belongings";

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
  formData?: Record<string, string | boolean>;
  qrUrl?: string;
  qrId?: string;
}

interface QRContextType {
  profiles: QRProfile[];
  addProfile: (profile: Omit<QRProfile, "id" | "scans" | "createdAt">) => QRProfile;
  updateProfile: (id: string, updates: Partial<QRProfile>) => void;
  deleteProfile: (id: string) => void;
}

const QRContext = createContext<QRContextType | null>(null);

const STORAGE_KEY = "stegofy_qr_profiles_v1";

const MOCK_PROFILES: QRProfile[] = [
  {
    id: "mock-1",
    name: "Bruno (Labrador)",
    type: "pet",
    status: "active",
    primaryContact: "+91 98*** ***12",
    privacyMode: "mask",
    scans: 3,
    createdAt: "2026-03-10",
    qrUrl: `${window.location.origin}/qr/mock-1`,
    qrId: "mock-1",
  },
  {
    id: "mock-2",
    name: "Honda City · MH01AB1234",
    type: "vehicle",
    status: "active",
    primaryContact: "+91 98*** ***12",
    privacyMode: "mask",
    scans: 7,
    createdAt: "2026-03-01",
    qrUrl: `${window.location.origin}/qr/mock-2`,
    qrId: "mock-2",
  },
];

function loadProfiles(): QRProfile[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return MOCK_PROFILES;
}

export function QRProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<QRProfile[]>(loadProfiles);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch {}
  }, [profiles]);

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
