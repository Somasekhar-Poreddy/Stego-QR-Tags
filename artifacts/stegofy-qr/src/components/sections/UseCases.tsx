import { Car, Heart, Cross, Shield, Briefcase, CreditCard, Home, Calendar, ContactRound, ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const CASES = [
  {
    icon: Car,
    title: "Vehicle Parking Tags",
    desc: "Resolve parking issues peacefully without sharing your real phone number.",
    iconColor: "text-blue-500",
    bgLight: "bg-blue-50",
    borderHover: "hover:border-blue-200",
  },
  {
    icon: Heart,
    title: "Pet ID Tags",
    desc: "Ensure your furry friends find their way home fast if they ever get lost.",
    iconColor: "text-rose-500",
    bgLight: "bg-rose-50",
    borderHover: "hover:border-rose-200",
  },
  {
    icon: Cross,
    title: "Medical Alert Tags",
    desc: "Provide critical medical info to first responders instantly in emergencies.",
    iconColor: "text-red-500",
    bgLight: "bg-red-50",
    borderHover: "hover:border-red-200",
  },
  {
    icon: Shield,
    title: "Child Safety Bands",
    desc: "Keep kids safe in crowded places. Finders can contact you securely.",
    iconColor: "text-green-500",
    bgLight: "bg-green-50",
    borderHover: "hover:border-green-200",
  },
  {
    icon: Briefcase,
    title: "Luggage Tags",
    desc: "Never lose your bags again. Finders can reach out from anywhere globally.",
    iconColor: "text-indigo-500",
    bgLight: "bg-indigo-50",
    borderHover: "hover:border-indigo-200",
  },
  {
    icon: CreditCard,
    title: "Wallet & Key Tags",
    desc: "Get your most important daily items back if dropped or forgotten.",
    iconColor: "text-amber-500",
    bgLight: "bg-amber-50",
    borderHover: "hover:border-amber-200",
  },
  {
    icon: Home,
    title: "Home Visitor QR",
    desc: "Manage deliveries and visitors without giving out your personal number.",
    iconColor: "text-teal-500",
    bgLight: "bg-teal-50",
    borderHover: "hover:border-teal-200",
  },
  {
    icon: Calendar,
    title: "Event QR Cards",
    desc: "Share event schedules, links, and contact info dynamically.",
    iconColor: "text-fuchsia-500",
    bgLight: "bg-fuchsia-50",
    borderHover: "hover:border-fuchsia-200",
  },
  {
    icon: ContactRound,
    title: "NFC Business Cards",
    desc: "Share your professional profile with a tap or a scan instantly.",
    iconColor: "text-slate-600",
    bgLight: "bg-slate-100",
    borderHover: "hover:border-slate-300",
  },
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
            <FadeIn key={index} delay={index * 0.08}>
              <div className={`group relative bg-white border border-slate-100 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${useCase.borderHover}`}>
                <div className={`w-14 h-14 rounded-xl ${useCase.bgLight} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <useCase.icon className={`w-7 h-7 ${useCase.iconColor}`} />
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-2">{useCase.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-5">
                  {useCase.desc}
                </p>

                <a href="#buy" className="inline-flex items-center text-sm font-semibold text-primary hover:opacity-80 transition-opacity">
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
