import { Home, QrCode, ScanLine, ShoppingBag, User } from "lucide-react";
import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Home", icon: Home, href: "/app" },
  { label: "Scan", icon: ScanLine, href: "/app/scan" },
  { label: "My QR", icon: QrCode, href: "/app/qr" },
  { label: "Shop", icon: ShoppingBag, href: "/app/shop" },
  { label: "Profile", icon: User, href: "/app/profile" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch h-16 max-w-lg mx-auto px-2">
        {TABS.map((tab) => {
          const isActive = tab.href === "/app"
            ? location === "/app" || location === "/app/"
            : location.startsWith(tab.href);

          return (
            <Link key={tab.href} href={tab.href} className="flex-1">
              <div
                className={cn(
                  "flex flex-col items-center justify-center h-full gap-0.5 rounded-xl mx-0.5 my-1.5 transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {tab.label === "My QR" && isActive ? (
                  <div className="bg-primary text-white p-2 rounded-xl -mt-5 shadow-lg shadow-primary/30">
                    <tab.icon className="w-5 h-5" />
                  </div>
                ) : (
                  <tab.icon className={cn("w-5 h-5", isActive && "scale-110")} />
                )}
                <span className={cn("text-[10px] font-semibold leading-none", tab.label === "My QR" && isActive ? "mt-1" : "")}>
                  {tab.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
