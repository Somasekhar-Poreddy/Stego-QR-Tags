import { PhoneCall, AlertCircle, Video, Edit, Lock, Smartphone } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const FEATURES = [
  {
    icon: PhoneCall,
    title: "Masked Communication",
    desc: "Finders call you via a secure proxy number. Your real phone number stays 100% hidden."
  },
  {
    icon: AlertCircle,
    title: "Emergency Contacts",
    desc: "Add multiple contacts. If you don't answer, the system automatically dials the next person."
  },
  {
    icon: Video,
    title: "Live Location & Video",
    desc: "Finders can share their live location or initiate a secure browser-based video call."
  },
  {
    icon: Edit,
    title: "Edit Anytime",
    desc: "Change your contact details or tag status (Lost/Safe) instantly from your dashboard."
  },
  {
    icon: Lock,
    title: "Total Ownership Control",
    desc: "Only you can edit the data. Physical tags are cryptographically locked to your account."
  },
  {
    icon: Smartphone,
    title: "No App Required",
    desc: "Finders just use their native camera app. No downloads or sign-ups needed for them."
  }
];

export function TrustSafety() {
  return (
    <section id="safety" className="py-24 bg-slate-900 relative overflow-hidden">
      {/* Dark mode background accents */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Privacy-First. <span className="text-primary">Safety-Focused.</span>
            </h2>
            <p className="text-lg text-slate-400">
              We built StegoTags with a "privacy by default" architecture. Share only what's necessary, exactly when it's needed.
            </p>
          </FadeIn>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, index) => (
            <FadeIn key={index} delay={index * 0.1}>
              <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-6 hover:bg-white/10 transition-colors duration-300">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mb-5">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

      </div>
    </section>
  );
}
