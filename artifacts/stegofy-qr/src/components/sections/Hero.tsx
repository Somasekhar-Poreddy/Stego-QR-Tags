import { ArrowRight, QrCode, ShieldCheck, MapPin, Phone } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";
import { useState, useEffect } from "react";

const ROTATING_WORDS = [
  "Cars & Bikes",
  "Pets",
  "Loved Ones",
  "Emergencies",
  "Your Home",
  "Luggage",
  "Wallet & Keys",
  "Events",
  "Business Cards",
];

export function Hero() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
        setIsAnimating(false);
      }, 300);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden">
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
                  {ROTATING_WORDS[currentIndex]}
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

          {/* Right Visual: Mock UI Card */}
          <div className="relative lg:h-[600px] flex items-start justify-center lg:-mt-10">
            {/* Decorative circles */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-primary/20 rounded-full animate-[spin_30s_linear_infinite]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-purple-500/20 rounded-full animate-[spin_20s_linear_infinite_reverse]"></div>

            <FadeIn delay={0.2} direction="left" className="relative z-10 w-full max-w-sm">
              {/* Phone Mockup Frame */}
              <div className="bg-white rounded-[2.5rem] shadow-2xl p-2 border-[8px] border-slate-900 mx-auto transform rotate-3 hover:rotate-0 transition-transform duration-500">
                <div className="bg-slate-50 rounded-[2rem] overflow-hidden h-[600px] flex flex-col relative">
                  
                  {/* Mock UI Header */}
                  <div className="bg-gradient-primary h-32 relative">
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-white rounded-full p-1 shadow-lg">
                      <div className="w-full h-full bg-slate-200 rounded-full flex items-center justify-center text-2xl font-bold text-slate-400">
                        {/* car dog placeholder */}
                        <img src="https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=200&h=200&fit=crop" className="w-full h-full rounded-full object-cover" alt="Pet" />
                      </div>
                    </div>
                  </div>

                  {/* Mock UI Content */}
                  <div className="pt-14 px-6 pb-6 flex-1 flex flex-col">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold text-slate-900">Max (Golden Retriever)</h3>
                      <p className="text-sm text-slate-500 flex items-center justify-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> Lost in Bandra West
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <div className="bg-green-100 text-green-600 p-2 rounded-full">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Owner</p>
                          <p className="text-sm font-semibold text-slate-900">Sarah Sharma</p>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <div className="bg-primary/10 text-primary p-2 rounded-full">
                          <Phone className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Masked Number</p>
                          <p className="text-sm font-semibold text-slate-900">+91 98*** ***45</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <button className="w-full bg-green-500 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 hover:bg-green-600 transition-colors">
                        <Phone className="w-5 h-5" /> Call Owner Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating scan badge */}
              <div className="absolute -right-12 top-20 bg-white rounded-2xl shadow-xl p-4 border border-slate-100 animate-bounce" style={{ animationDuration: '3s' }}>
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg text-primary">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Status</p>
                    <p className="text-sm font-bold text-green-600">Scanned Just Now</p>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>

        </div>
      </div>
    </section>
  );
}
