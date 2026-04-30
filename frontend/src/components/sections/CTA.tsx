import { ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

export function CTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-blue-600 to-purple-700"></div>
      
      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
      
      {/* Glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/10 rounded-full blur-[100px]"></div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <FadeIn>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Start Protecting What <br className="hidden sm:block"/> Matters Today
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Join thousands of users who trust StegoTags to keep their belongings, pets, and loved ones safe. Setup takes less than 2 minutes.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a href="#buy" className="bg-white text-primary px-8 py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-1 transition-all flex items-center justify-center gap-2">
              Buy Premium Tags
              <ArrowRight className="w-5 h-5" />
            </a>
            <a href="#how-it-works" className="bg-white/10 text-white border-2 border-white/20 px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 hover:border-white/40 transition-all flex items-center justify-center">
              Create Free Profile
            </a>
          </div>
          
          <p className="mt-8 text-sm text-blue-200">
            No credit card required for digital profiles. Free shipping on all physical tags.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
