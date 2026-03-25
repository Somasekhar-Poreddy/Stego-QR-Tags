import { Plus, ScanLine, ShoppingBag, QrCode, Bell, Eye, Edit, Share2, ChevronRight, Shield, ToggleRight } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useQR } from "@/app/context/QRContext";
import { AppHeader } from "@/app/components/AppHeader";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  pet: "bg-rose-100 text-rose-600",
  vehicle: "bg-blue-100 text-blue-600",
  child: "bg-green-100 text-green-600",
  medical: "bg-red-100 text-red-600",
  luggage: "bg-indigo-100 text-indigo-600",
  wallet: "bg-amber-100 text-amber-600",
  home: "bg-teal-100 text-teal-600",
  event: "bg-fuchsia-100 text-fuchsia-600",
  business: "bg-slate-100 text-slate-600",
};

const ACTIVITY = [
  { msg: "Someone tried to contact you", time: "2 min ago", icon: Bell, color: "bg-primary/10 text-primary" },
  { msg: "QR scanned 2 times today", time: "1 hr ago", icon: QrCode, color: "bg-violet-100 text-violet-600" },
  { msg: "Bruno's tag scanned near Park", time: "3 hr ago", icon: Eye, color: "bg-green-100 text-green-600" },
];

const SHOP_ITEMS = [
  { name: "Pet Tag", price: "₹299", tag: "Popular", color: "from-rose-400 to-pink-400" },
  { name: "Car Tag", price: "₹399", tag: "Best Seller", color: "from-blue-400 to-cyan-400" },
  { name: "NFC Card", price: "₹499", tag: "New", color: "from-violet-400 to-purple-400" },
];

export function HomeScreen() {
  const { user } = useAuth();
  const { profiles } = useQR();
  const [, navigate] = useLocation();

  return (
    <div className="bg-slate-50 min-h-full">
      <AppHeader />

      <div className="px-4 pt-4 pb-2 space-y-5">
        {/* Primary Actions */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Create QR", icon: Plus, href: "/app/qr/create", color: "bg-gradient-to-br from-primary to-violet-600 text-white shadow-primary/30" },
            { label: "Scan QR", icon: ScanLine, href: "/app/scan", color: "bg-white text-slate-700 border border-slate-100 shadow-slate-100/50" },
            { label: "Buy Tags", icon: ShoppingBag, href: "/app/shop", color: "bg-white text-slate-700 border border-slate-100 shadow-slate-100/50" },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => navigate(a.href)}
              className={cn("flex flex-col items-center gap-2 py-4 rounded-2xl shadow-md transition-all active:scale-95", a.color)}
            >
              <a.icon className="w-5 h-5" />
              <span className="text-xs font-semibold">{a.label}</span>
            </button>
          ))}
        </div>

        {/* QR Profiles */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Your QR Profiles</h2>
            <button onClick={() => navigate("/app/qr")} className="text-xs text-primary font-semibold flex items-center gap-0.5">
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2.5">
            {profiles.slice(0, 3).map((p) => (
              <div key={p.id} className="bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-slate-100 flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", TYPE_COLORS[p.type] || "bg-slate-100 text-slate-600")}>
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{p.type} · {p.scans} scans</p>
                </div>
                <div className="flex items-center gap-1">
                  <div className={cn("w-2 h-2 rounded-full", p.status === "active" ? "bg-green-400" : "bg-slate-300")} />
                  <span className="text-xs text-slate-400">{p.status}</span>
                </div>
              </div>
            ))}
            <button
              onClick={() => navigate("/app/qr/create")}
              className="w-full border-2 border-dashed border-primary/30 rounded-2xl py-3 text-sm text-primary font-semibold flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add New QR
            </button>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <h2 className="text-sm font-bold text-slate-900 mb-3">Recent Activity</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0", a.color)}>
                  <a.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 leading-tight">{a.msg}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Safety Settings */}
        <section>
          <h2 className="text-sm font-bold text-slate-900 mb-3">Safety Settings</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Privacy Status</p>
                  <p className="text-[10px] text-slate-400">Number is masked for all</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Protected</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ToggleRight className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Strict Mode</p>
                  <p className="text-[10px] text-slate-400">Require code to contact</p>
                </div>
              </div>
              <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow" />
              </div>
            </div>
          </div>
        </section>

        {/* Shop Preview */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Shop</h2>
            <button onClick={() => navigate("/app/shop")} className="text-xs text-primary font-semibold flex items-center gap-0.5">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {SHOP_ITEMS.map((item) => (
              <div key={item.name} className="flex-shrink-0 w-32 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className={cn("h-16 bg-gradient-to-br flex items-center justify-center", item.color)}>
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-bold text-slate-800">{item.name}</p>
                  <p className="text-xs text-primary font-semibold mt-0.5">{item.price}</p>
                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">{item.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
