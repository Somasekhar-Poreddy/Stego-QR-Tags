import { useState } from "react";
import { UserPlus, Settings, Tag, QrCode, PhoneForwarded, ShoppingBag, Fingerprint } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";
import { cn } from "@/lib/utils";

const DIGITAL_STEPS = [
  { icon: UserPlus, title: "Sign Up", desc: "Create a free Stegofy account in seconds." },
  { icon: Settings, title: "Create Profile", desc: "Add emergency contacts, vehicle info, or pet details." },
  { icon: QrCode, title: "Generate QR", desc: "Get your unique dynamic QR code instantly." },
  { icon: PhoneForwarded, title: "Ready to Scan", desc: "Anyone scanning connects with you securely." }
];

const PHYSICAL_STEPS = [
  { icon: ShoppingBag, title: "Order Tag", desc: "Choose a premium physical tag from our store." },
  { icon: Fingerprint, title: "Link Tag", desc: "Scan the new tag to link it to your profile." },
  { icon: Tag, title: "Attach", desc: "Place it on your car, pet, luggage or keys." },
  { icon: QrCode, title: "Scan", desc: "Finder scans the tag with any smartphone." },
  { icon: PhoneForwarded, title: "Connect", desc: "Finder calls you via masked number." }
];

export function HowItWorks() {
  const [activeTab, setActiveTab] = useState<'digital' | 'physical'>('physical');

  const steps = activeTab === 'digital' ? DIGITAL_STEPS : PHYSICAL_STEPS;

  return (
    <section id="how-it-works" className="py-24 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center max-w-3xl mx-auto mb-16">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Simple. Fast. <span className="text-primary">Powerful.</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Whether you want to create a free digital profile or order premium physical tags, the setup takes less than two minutes.
            </p>
          </FadeIn>
        </div>

        {/* Tab Toggle */}
        <FadeIn delay={0.1} className="flex justify-center mb-16">
          <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 inline-flex">
            <button
              onClick={() => setActiveTab('physical')}
              className={cn(
                "px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300",
                activeTab === 'physical'
                  ? "bg-primary text-white shadow-md"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              Physical Tag Flow
            </button>
            <button
              onClick={() => setActiveTab('digital')}
              className={cn(
                "px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300",
                activeTab === 'digital'
                  ? "bg-primary text-white shadow-md"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              Digital Only Setup
            </button>
          </div>
        </FadeIn>

        {/* Steps — horizontal on desktop, vertical on mobile */}
        <div className="relative max-w-5xl mx-auto">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-[2.25rem] left-[calc(10%+1.5rem)] right-[calc(10%+1.5rem)] h-0.5 bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10 rounded-full z-0"></div>

          <div
            className="grid grid-cols-1 gap-8 relative z-10 md:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
            style={{ '--cols': steps.length } as React.CSSProperties}
          >
            {steps.map((step, index) => (
              <FadeIn key={`${activeTab}-${index}`} delay={0.08 * index} className="flex flex-col items-center text-center group">
                <div className="w-[4.5rem] h-[4.5rem] bg-white rounded-2xl shadow-lg border-2 border-primary/20 flex items-center justify-center mb-5 relative group-hover:-translate-y-2 group-hover:border-primary group-hover:shadow-primary/20 transition-all duration-300">
                  <step.icon className="w-7 h-7 text-primary group-hover:scale-110 transition-transform" />
                  <div className="absolute -top-3 -right-3 w-7 h-7 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold border-4 border-slate-50">
                    {index + 1}
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">{step.title}</h3>
                <p className="text-xs text-slate-500 px-2 leading-snug">{step.desc}</p>
              </FadeIn>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
