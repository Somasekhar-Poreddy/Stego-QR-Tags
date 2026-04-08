import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

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
  pinCode?: string;
  displayCode?: string;
  // ── Manage QR settings ───────────────────────────────────
  isActive?: boolean;
  allowContact?: boolean;
  strictMode?: boolean;
  whatsappEnabled?: boolean;
  allowVideoCall?: boolean;
  secondaryPhone?: string;
  manageEmergencyContact?: string;
  callMaskingDisabled?: boolean;
}

interface QRContextType {
  profiles: QRProfile[];
  addProfile: (profile: Omit<QRProfile, "id" | "scans" | "createdAt">) => QRProfile;
  updateProfile: (id: string, updates: Partial<QRProfile>) => void;
  deleteProfile: (id: string) => void;
  loadUserProfiles: (userId: string) => Promise<void>;
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

function rowToProfile(row: Record<string, unknown>): QRProfile {
  return {
    id: row.id as string,
    qrId: row.id as string,
    name: (row.name as string) || "Unnamed",
    type: (row.type as QRType) || "belongings",
    status: (row.status as "active" | "inactive") || "active",
    primaryContact: (row.primary_contact as string) || "",
    privacyMode: (row.privacy_mode as QRProfile["privacyMode"]) || "mask",
    notes: (row.notes as string) || undefined,
    formData: (row.data as Record<string, string | boolean>) || {},
    qrUrl: (row.qr_url as string) || `${window.location.origin}/qr/${row.id}`,
    scans: (row.scans as number) || 0,
    createdAt: (row.created_at as string) || new Date().toISOString().split("T")[0],
    pinCode: (row.pin_code as string) || undefined,
    displayCode: (row.display_code as string) || undefined,
    isActive: row.is_active != null ? (row.is_active as boolean) : true,
    allowContact: row.allow_contact != null ? (row.allow_contact as boolean) : true,
    strictMode: row.strict_mode != null ? (row.strict_mode as boolean) : false,
    whatsappEnabled: row.whatsapp_enabled != null ? (row.whatsapp_enabled as boolean) : false,
    allowVideoCall: row.allow_video_call != null ? (row.allow_video_call as boolean) : false,
    secondaryPhone: (row.secondary_phone as string) || undefined,
    manageEmergencyContact: (row.emergency_contact as string) || undefined,
    callMaskingDisabled: row.call_masking_disabled != null ? (row.call_masking_disabled as boolean) : false,
  };
}

export function QRProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<QRProfile[]>(loadProfiles);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch {}
  }, [profiles]);

  const loadUserProfiles = useCallback(async (userId: string): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        // Supabase reachable but query failed — keep local state as fallback
        console.warn("Could not load QR profiles from Supabase:", error.message);
        return;
      }

      // Query succeeded: always replace local state with server truth.
      // This clears any stale or mock data from a previous user session.
      const loaded = (data ?? []).map(rowToProfile);
      setProfiles(loaded);
    } catch (err) {
      // Network unreachable — silently keep current localStorage state
      console.warn("QR profile load failed, using local data:", err);
    }
  }, []);

  const addProfile = (profile: Omit<QRProfile, "id" | "scans" | "createdAt">) => {
    const newProfile: QRProfile = {
      ...profile,
      id: profile.qrId ?? Date.now().toString(),
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
    <QRContext.Provider value={{ profiles, addProfile, updateProfile, deleteProfile, loadUserProfiles }}>
      {children}
    </QRContext.Provider>
  );
}

export function useQR() {
  const ctx = useContext(QRContext);
  if (!ctx) throw new Error("useQR must be used within QRProvider");
  return ctx;
}
