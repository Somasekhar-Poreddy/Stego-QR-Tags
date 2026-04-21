import { ArrowRight, QrCode, ShieldCheck, MapPin, Phone, Car, Heart, Cross, Shield, Briefcase, CreditCard, Home, Calendar, ContactRound, AlertCircle, User } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";
import { useState, useEffect } from "react";

const SLIDES = [
  {
    word: "Cars & Bikes",
    headerBg: "from-blue-500 to-cyan-400",
    image: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=200&h=200&fit=crop&auto=format",
    title: "Honda City",
    subtitle: "MH 01 AB 1234",
    tag: "Parking Tag",
    fields: [
      { label: "Owner", value: "Rahul Sharma", icon: User, color: "text-blue-500", bg: "bg-blue-50" },
      { label: "Masked Number", value: "+91 98*** ***12", icon: Phone, color: "text-slate-500", bg: "bg-slate-50" },
    ],
    btnText: "Contact Car Owner",
    btnColor: "bg-blue-500 shadow-blue-500/30 hover:bg-blue-600",
  },
  {
    word: "Pets",
    headerBg: "from-rose-500 to-pink-400",
    image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=200&h=200&fit=crop&auto=format",
    title: "Max (Golden Retriever)",
    subtitle: "Lost in Bandra West",
    tag: "Pet ID Tag",
    fields: [
      { label: "Owner", value: "Sarah Sharma", icon: ShieldCheck, color: "text-green-500", bg: "bg-green-50" },
      { label: "Masked Number", value: "+91 98*** ***45", icon: Phone, color: "text-slate-500", bg: "bg-slate-50" },
    ],
    btnText: "Call Owner Now",
    btnColor: "bg-green-500 shadow-green-500/30 hover:bg-green-600",
  },
  {
    word: "Loved Ones",
    headerBg: "from-green-500 to-emerald-400",
    image: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=200&h=200&fit=crop&auto=format",
    title: "Aarav Sharma",
    subtitle: "Age 6 · Child Safety Band",
    tag: "Child Safety",
    fields: [
      { label: "Parent", value: "Priya Sharma", icon: User, color: "text-green-500", bg: "bg-green-50" },
      { label: "Emergency", value: "+91 97*** ***88", icon: Phone, color: "text-slate-500", bg: "bg-slate-50" },
    ],
    btnText: "Contact Parent",
    btnColor: "bg-green-500 shadow-green-500/30 hover:bg-green-600",
  },
  {
    word: "Emergencies",
    headerBg: "from-red-500 to-orange-400",
    image: "https://images.unsplash.com/photo-1584515933487-779824d29309?w=200&h=200&fit=crop&auto=format",
    title: "Rahul Verma",
    subtitle: "Blood Type: A+ · Diabetic",
    tag: "Medical Alert",
    fields: [
      { label: "Allergy", value: "Penicillin", icon: AlertCircle, color: "text-red-500", bg: "bg-red-50" },
      { label: "Emergency", value: "+91 99*** ***01", icon: Phone, color: "text-slate-500", bg: "bg-slate-50" },
    ],
    btnText: "Call Emergency Contact",
    btnColor: "bg-red-500 shadow-red-500/30 hover:bg-red-600",
  },
  {
    word: "Your Home",
    headerBg: "from-teal-500 to-cyan-400",
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=200&h=200&fit=crop&auto=format",
    title: "Sharma Residence",
    subtitle: "Visitor / Delivery QR",
    tag: "Home QR",
    fields: [
      { label: "Host", value: "Meera Sharma", icon: User, color: "text-teal-500", bg: "bg-teal-50" },
      { label: "Ring", value: "Masked doorbell", icon: Phone, color: "text-slate-500", bg: "bg-slate-50" },
    ],
    btnText: "Notify Homeowner",
    btnColor: "bg-teal-500 shadow-teal-500/30 hover:bg-teal-600",
  },
  {
    word: "Luggage",
    headerBg: "from-indigo-500 to-purple-400",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&h=200&fit=crop&auto=format",
    title: "Priya Singh's Bag",
    subtitle: "Flight AI-202 · Row 14C",
    tag: "Luggage Tag",
    fields: [
      { label: "Owner", value: "Priya Singh", icon: User, color: "text-indigo-500", bg: "bg-indigo-50" },
      { label: "Contact", value: "+91 96*** ***34", icon: Phone, color: "text-slate-500", bg: "bg-slate-50" },
    ],
    btnText: "Return Luggage",
    btnColor: "bg-indigo-500 shadow-indigo-500/30 hover:bg-indigo-600",
  },
  {
    word: "Wallet & Keys",
    headerBg: "from-amber-500 to-yellow-400",
    image: "https://images.unsplash.com/photo-1627843563095-f6e94676cfe0?w=200&h=200&fit=crop&auto=format",
    title: "Lost Wallet",
    subtitle: "Reward offered if found",
    tag: "Wallet Tag",
    fields: [
      { label: "Owner", value: "Amit Joshi", icon: User, color: "text-amber-500", bg: "bg-amber-50" },
      { label: "Contact", value: "+91 93*** ***77", icon: Phone, color: "text-slate-500", bg: "bg-slate-50" },
    ],
    btnText: "Contact Owner",
    btnColor: "bg-amber-500 shadow-amber-500/30 hover:bg-amber-600",
  },
  {
    word: "Events",
    headerBg: "from-fuchsia-500 to-pink-400",
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=200&h=200&fit=crop&auto=format",
    title: "TechConf 2025",
    subtitle: "Mar 30 · Hall B, Mumbai",
    tag: "Event QR",
    fields: [
      { label: "Organiser", value: "Stegofy Events", icon: User, color: "text-fuchsia-500", bg: "bg-fuchsia-50" },
      { label: "RSVP", value: "Scan to register", icon: QrCode, color: "text-slate-500", bg: "bg-slate-50" },
    ],
    btnText: "View Event Details",
    btnColor: "bg-fuchsia-500 shadow-fuchsia-500/30 hover:bg-fuchsia-600",
  },
  {
    word: "Business Cards",
    headerBg: "from-slate-700 to-slate-500",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format",
    title: "Raj Kumar",
    subtitle: "Product Manager · Stegofy",
    tag: "NFC Card",
    fields: [
      { label: "Email", value: "raj@stegofy.in", icon: MapPin, color: "text-slate-500", bg: "bg-slate-50" },
      { label: "Phone", value: "+91 98*** ***00", icon: Phone, color: "text-slate-500", bg: "bg-slate-50" },
    ],
    btnText: "Save Contact",
    btnColor: "bg-slate-700 shadow-slate-700/30 hover:bg-slate-800",
  },
];

export function Hero() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % SLIDES.length);
        setIsAnimating(false);
      }, 300);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const slide = SLIDES[currentIndex];

  return (
    <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-24 overflow-hidden">
      {/* Glowing Background Blobs */}
      <div className="glow-blob bg-primary/20 w-[600px] h-[600px] top-[-100px] left-[-200px]"></div>
      <div className="glow-blob bg-purple-500/20 w-[500px] h-[500px] bottom-[0px] right-[-100px]" style={{ animationDelay: '-5s' }}></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

          {/* Left Content */}
          <div className="max-w-2xl">
            <FadeIn>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <ShieldCheck className="w-4 h-4" />
                <span>Smart Privacy Protection</span>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold leading-[1.15] mb-5 text-foreground">
                Smart QR Tags for<br />
                <span className="block">Everything That Matters</span>
                <span
                  className="block mt-1.5 bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 bg-clip-text text-transparent transition-all duration-300"
                  style={{
                    opacity: isAnimating ? 0 : 1,
                    transform: isAnimating ? "translateY(8px)" : "translateY(0)",
                  }}
                >
                  {slide.word}
                </span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.2}>
              <p className="text-base sm:text-lg text-muted-foreground mb-8 leading-relaxed">
                Because the things you care about should always find their way back to you.
              </p>
            </FadeIn>

            <FadeIn delay={0.3} className="flex flex-col sm:flex-row gap-4">
              <a href="#buy" className="bg-gradient-primary px-8 py-4 rounded-xl text-white font-semibold text-lg hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group">
                Buy QR Tags
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="#how-it-works" className="bg-white text-foreground border-2 border-border px-8 py-4 rounded-xl font-semibold text-lg hover:border-primary hover:text-primary hover:shadow-lg transition-all flex items-center justify-center">
                Create Free Profile
              </a>
            </FadeIn>

            <FadeIn delay={0.4} className="mt-10 flex items-center gap-6 text-sm text-muted-foreground font-medium">
              <div className="flex -space-x-3">
                <img className="w-10 h-10 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" alt="User" />
                <img className="w-10 h-10 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop" alt="User" />
                <img className="w-10 h-10 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop" alt="User" />
                <div className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-xs text-slate-600">+10k</div>
              </div>
              <p>Trusted by thousands everyday</p>
            </FadeIn>
          </div>

          {/* Right Visual: Synced Phone Mockup */}
          <div className="relative lg:h-[580px] flex items-start justify-center lg:-mt-10">
            {/* Decorative circles */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] border border-primary/20 rounded-full animate-[spin_30s_linear_infinite]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] border border-purple-500/20 rounded-full animate-[spin_20s_linear_infinite_reverse]"></div>

            <FadeIn delay={0.2} direction="left" className="relative z-10 w-full max-w-[240px]">
              {/* Smaller Phone Frame */}
              <div className="bg-white rounded-[2rem] shadow-2xl p-1.5 border-[6px] border-slate-900 mx-auto transform rotate-3 hover:rotate-0 transition-transform duration-500">
                <div
                  className="bg-slate-50 rounded-[1.6rem] overflow-hidden flex flex-col relative"
                  style={{ height: "460px" }}
                >
                  {/* Dynamic Header */}
                  <div
                    className={`bg-gradient-to-br ${slide.headerBg} h-24 relative flex-shrink-0 rounded-t-[1.5rem] transition-all duration-500`}
                    style={{ opacity: isAnimating ? 0 : 1 }}
                  >
                    {/* Tag badge */}
                    <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      {slide.tag}
                    </div>
                    {/* Real image avatar */}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full shadow-lg border-2 border-white overflow-hidden">
                      <img
                        src={slide.image}
                        alt={slide.title}
                        className="w-full h-full object-cover rounded-full"
                        style={{ opacity: isAnimating ? 0 : 1, transition: "opacity 0.3s" }}
                      />
                    </div>
                  </div>

                  {/* Dynamic Content */}
                  <div
                    className="pt-11 px-4 pb-4 flex-1 flex flex-col transition-all duration-300"
                    style={{ opacity: isAnimating ? 0 : 1, transform: isAnimating ? "translateY(6px)" : "translateY(0)" }}
                  >
                    <div className="text-center mb-4">
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">{slide.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center justify-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        {slide.subtitle}
                      </p>
                    </div>

                    <div className="space-y-2 flex-1">
                      {slide.fields.map((field, i) => (
                        <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-2.5">
                          <div className={`${field.bg} ${field.color} p-1.5 rounded-full flex-shrink-0`}>
                            <field.icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-medium leading-none mb-0.5">{field.label}</p>
                            <p className="text-xs font-semibold text-slate-800">{field.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3">
                      <button className={`w-full ${slide.btnColor} text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-colors`}>
                        <Phone className="w-3.5 h-3.5" /> {slide.btnText}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating scan badge */}
              <div className="absolute -right-24 top-16 bg-white rounded-xl shadow-xl p-3 border border-slate-100 animate-bounce" style={{ animationDuration: '3s' }}>
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Status</p>
                    <p className="text-xs font-bold text-green-600">Scanned Just Now</p>
                  </div>
                </div>
              </div>

              {/* Dot indicators */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
                {SLIDES.map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-300 ${i === currentIndex ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-slate-300"}`}
                  />
                ))}
              </div>
            </FadeIn>
          </div>

        </div>
      </div>
    </section>
  );
}
