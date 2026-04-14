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
  const [profiles, setProfiles] = useState<QRProfile[]>([]);

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
