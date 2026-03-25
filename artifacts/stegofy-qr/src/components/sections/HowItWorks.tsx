import { UserPlus, Settings, Tag, QrCode, PhoneForwarded, ShoppingBag, Fingerprint } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

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

function FlowColumn({
  label,
  labelColor,
  steps,
  accentFrom,
  accentTo,
  delay = 0,
}: {
  label: string;
  labelColor: string;
  steps: typeof DIGITAL_STEPS;
  accentFrom: string;
  accentTo: string;
  delay?: number;
}) {
  return (
    <FadeIn delay={delay} className="flex flex-col">
      <div className={`inline-flex items-center gap-2 self-start mb-8 px-4 py-2 rounded-full text-sm font-semibold ${labelColor}`}>
        <span className="w-2 h-2 rounded-full bg-current opacity-70"></span>
        {label}
      </div>

      <div className="relative flex flex-col gap-0">
        {steps.map((step, index) => (
          <div key={index} className="flex gap-4 group">
            {/* Icon column with connector line */}
            <div className="flex flex-col items-center">
              <div className={`w-12 h-12 bg-white rounded-2xl shadow-md border-2 border-slate-100 flex items-center justify-center relative flex-shrink-0 group-hover:border-primary group-hover:shadow-primary/20 group-hover:-translate-y-0.5 transition-all duration-300`}>
                <step.icon className="w-5 h-5 text-primary" />
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                  {index + 1}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-0.5 flex-1 my-1 bg-gradient-to-b ${accentFrom} ${accentTo} min-h-[2rem]`}></div>
              )}
            </div>

            {/* Text content */}
            <div className="pt-1 pb-6 last:pb-0">
              <h3 className="text-sm font-bold text-slate-900 leading-tight">{step.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </FadeIn>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center max-w-3xl mx-auto mb-16">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Simple. Fast. <span className="text-primary">Powerful.</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Whether you want a free digital profile or premium physical tags — setup takes less than two minutes.
            </p>
          </FadeIn>
        </div>

        {/* Two flows side by side on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">

          {/* Physical Tag Flow */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <FlowColumn
              label="Physical Tag Flow"
              labelColor="bg-primary/10 text-primary"
              steps={PHYSICAL_STEPS}
              accentFrom="from-primary/40"
              accentTo="to-primary/10"
              delay={0.1}
            />
          </div>

          {/* Digital Only Flow */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <FlowColumn
              label="Digital Only Setup"
              labelColor="bg-violet-100 text-violet-600"
              steps={DIGITAL_STEPS}
              accentFrom="from-violet-400/40"
              accentTo="to-violet-400/10"
              delay={0.2}
            />
          </div>

        </div>

      </div>
    </section>
  );
}
