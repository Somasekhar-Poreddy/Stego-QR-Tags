import { useState, useCallback } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ConfirmWithPasswordModal } from "@/admin/components/ConfirmWithPasswordModal";

interface GuardConfig {
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "default" | "danger";
  /** The action to run after the password is verified. */
  run: () => void | Promise<void>;
  /** Shown as a toast on successful completion. Defaults to "Done." */
  successMessage?: string;
}

/**
 * Hook that gives a screen a single re-authentication modal it can use to
 * step-up any number of destructive actions.
 *
 * Usage:
 *   const reauth = useReauthGuard();
 *   ...
 *   <button onClick={() => reauth.guard({
 *     title: "Delete user",
 *     description: `This will permanently delete ${name}'s account.`,
 *     confirmLabel: "Delete user",
 *     variant: "danger",
 *     run: () => doDelete(),
 *   })}>Delete</button>
 *   ...
 *   {reauth.modal}
 *
 * The modal renders nothing when no action is pending, so it's free to mount
 * unconditionally.
 */
export function useReauthGuard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pending, setPending] = useState<GuardConfig | null>(null);

  const guard = useCallback((cfg: GuardConfig) => {
    setPending(cfg);
  }, []);

  const cancel = useCallback(() => setPending(null), []);

  const onConfirmed = useCallback(async () => {
    if (!pending) return;
    const cfg = pending;
    // Close the modal optimistically so the action's own UI feedback isn't
    // hidden behind the password sheet.
    setPending(null);
    try {
      await cfg.run();
      toast({
        title: cfg.successMessage ?? "Done.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The action failed.";
      console.error("[useReauthGuard] action threw:", e);
      toast({
        title: "Action failed",
        description: msg,
        variant: "destructive",
      });
    }
  }, [pending, toast]);

  const modal = (
    <ConfirmWithPasswordModal
      open={!!pending}
      adminEmail={user?.email ?? ""}
      title={pending?.title ?? ""}
      description={pending?.description ?? ""}
      confirmLabel={pending?.confirmLabel ?? "Confirm"}
      variant={pending?.variant}
      onCancel={cancel}
      onConfirmed={onConfirmed}
    />
  );

  return { guard, modal };
}
