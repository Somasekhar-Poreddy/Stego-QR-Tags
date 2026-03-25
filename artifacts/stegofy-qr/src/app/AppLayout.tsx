import { ReactNode } from "react";
import { BottomNav } from "@/app/components/BottomNav";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-lg mx-auto relative">
      <div className="flex-1 overflow-y-auto pb-20">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
