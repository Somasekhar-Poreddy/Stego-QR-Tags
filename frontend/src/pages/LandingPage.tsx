import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { UseCases } from "@/components/sections/UseCases";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Products } from "@/components/sections/Products";
import { TrustSafety } from "@/components/sections/TrustSafety";
import { Scenarios } from "@/components/sections/Scenarios";
import { CTA } from "@/components/sections/CTA";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main>
        <Hero />
        <UseCases />
        <HowItWorks />
        <Products />
        <TrustSafety />
        <Scenarios />
        <CTA />
      </main>

      <Footer />
    </div>
  );
}
