import { Car, Heart, Cross, Shield, Briefcase, CreditCard, Home, Calendar, ContactRound, ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const CASES = [
  {
    icon: Car,
    title: "Vehicle Parking Tags",
    desc: "Resolve parking issues peacefully without sharing your real phone number.",
    color: "from-blue-500 to-cyan-400",
    bgLight: "bg-blue-50"
  },
  {
    icon: Heart,
    title: "Pet ID Tags",
    desc: "Ensure your furry friends find their way home fast if they ever get lost.",
    color: "from-rose-500 to-pink-400",
    bgLight: "bg-rose-50"
  },
  {
    icon: Cross,
    title: "Medical Alert Tags",
    desc: "Provide critical medical info to first responders instantly in emergencies.",
    color: "from-red-500 to-orange-400",
    bgLight: "bg-red-50"
  },
  {
    icon: Shield,
    title: "Child Safety Bands",
    desc: "Keep kids safe in crowded places. Finders can contact you securely.",
    color: "from-green-500 to-emerald-400",
    bgLight: "bg-green-50"
  },
  {
    icon: Briefcase,
    title: "Luggage Tags",
    desc: "Never lose your bags again. Finders can reach out from anywhere globally.",
    color: "from-indigo-500 to-purple-400",
    bgLight: "bg-indigo-50"
  },
  {
    icon: CreditCard,
    title: "Wallet & Key Tags",
    desc: "Get your most important daily items back if dropped or forgotten.",
    color: "from-amber-500 to-yellow-400",
    bgLight: "bg-amber-50"
  },
  {
    icon: Home,
    title: "Home Visitor QR",
    desc: "Manage deliveries and visitors without giving out your personal number.",
    color: "from-teal-500 to-green-400",
    bgLight: "bg-teal-50"
  },
  {
    icon: Calendar,
    title: "Event QR Cards",
    desc: "Share event schedules, links, and contact info dynamically.",
    color: "from-fuchsia-500 to-pink-400",
    bgLight: "bg-fuchsia-50"
  },
  {
    icon: ContactRound,
    title: "NFC Business Cards",
    desc: "Share your professional profile with a tap or a scan instantly.",
    color: "from-slate-700 to-slate-500",
    bgLight: "bg-slate-100"
  }
];

export function UseCases() {
  return (
    <section id="products" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              One Platform. <span className="text-primary">Multiple Everyday Uses.</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              A single Stegofy account lets you manage unlimited smart tags for every aspect of your life. Update information anytime, anywhere.
            </p>
          </FadeIn>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CASES.map((useCase, index) => (
            <FadeIn key={index} delay={index * 0.1}>
              <div className="group relative bg-white border border-slate-100 rounded-2xl p-6 hover:shadow-xl hover:border-primary/20 hover:-translate-y-1 transition-all duration-300">
                <div className={`w-14 h-14 rounded-xl ${useCase.bgLight} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <div className={`bg-gradient-to-br ${useCase.color} bg-clip-text text-transparent`}>
                    <useCase.icon className="w-7 h-7 stroke-[url(#gradient)]" stroke="currentColor" style={{ stroke: 'url(#myGradient)' }} />
                    <svg width="0" height="0">
                      <linearGradient id="myGradient" x1="100%" y1="100%" x2="0%" y2="0%">
                        <stop stopColor="currentColor" offset="0%" />
                        <stop stopColor="currentColor" offset="100%" />
                      </linearGradient>
                    </svg>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-2">{useCase.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                  {useCase.desc}
                </p>

                <a href="#buy" className="inline-flex items-center text-sm font-semibold text-primary group-hover:text-purple transition-colors">
                  Explore Tags <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
