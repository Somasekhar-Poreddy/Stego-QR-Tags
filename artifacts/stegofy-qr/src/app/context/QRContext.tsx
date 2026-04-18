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
  /**
   * Loads QR profiles for the given user from Supabase.
   * Returns true when the load succeeded (regardless of how many rows came
   * back) and false when it failed or was suppressed (no session, network
   * error, RLS block). Callers should retry on `false`, not on `true`.
   */
  loadUserProfiles: (userId: string) => Promise<boolean>;
}

const QRContext = createContext<QRContextType | null>(null);

const STORAGE_KEY = "stegofy_qr_profiles_v1";

function readProfilesFromStorage(): QRProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QRProfile[]) : [];
  } catch {
    return [];
  }
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
  // Initialise from localStorage so the UI never starts empty when we already
  // have cached profiles from a previous session.
  const [profiles, setProfiles] = useState<QRProfile[]>(() => readProfilesFromStorage());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch {}
  }, [profiles]);

  // Reset profile state whenever the auth session changes to a different
  // user (or no user). Without this, signing out of one account and into
  // another in the same browser shows the previous account's QR list until
  // the fresh fetch lands — which in turn can be slowed by lock contention,
  // making the "home screen never loads" bug visible.
  useEffect(() => {
    let lastUserId: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        lastUserId = null;
        setProfiles([]);
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        return;
      }
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        if (lastUserId && lastUserId !== session.user.id) {
          setProfiles([]);
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
        }
        lastUserId = session.user.id;
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfiles = useCallback(async (userId: string): Promise<boolean> => {
    try {
      // Guard 1: no session ⇒ RLS will silently return [] and we'd wipe state.
      // Skip the fetch entirely and let AuthContext handle the auth flow.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn("[QRContext] No active session; skipping profile load.");
        return false;
      }

      const { data, error } = await supabase
        .from("qr_codes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        // Supabase reachable but query failed — keep current state as fallback.
        console.warn("[QRContext] Profile load failed:", error.message);
        return false;
      }

      const loaded = (data ?? []).map(rowToProfile);

      // Guard 2: never replace a populated list with an empty one. An empty
      // response can mean "user genuinely has no QRs" OR "RLS silently
      // filtered everything out because the JWT was rotating". The safe
      // thing on a tie is to keep what we have.
      setProfiles((prev) => {
        if (loaded.length === 0 && prev.length > 0) {
          console.warn(
            "[QRContext] Empty profile response while local state is populated — retaining existing profiles to avoid blank UI.",
          );
          return prev;
        }
        return loaded;
      });
      return true;
    } catch (err) {
      // Network unreachable — keep current state.
      console.warn("[QRContext] Profile load threw:", err);
      return false;
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
