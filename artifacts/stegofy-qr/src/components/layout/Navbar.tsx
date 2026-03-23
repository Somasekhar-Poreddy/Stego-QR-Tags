import { useState, useEffect } from "react";
import {
  Menu, X, QrCode, ShoppingCart, ChevronDown,
  Car, Heart, Cross, Shield, Briefcase, CreditCard, Home, Calendar, ContactRound, Moon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const PRODUCTS_MENU = [
  { name: "Vehicle Tags", icon: Car },
  { name: "Pet Tags", icon: Heart },
  { name: "Medical Tags", icon: Cross },
  { name: "Child Safety", icon: Shield },
  { name: "Luggage Tags", icon: Briefcase },
  { name: "Wallet/Key Tags", icon: CreditCard },
  { name: "Home QR", icon: Home },
  { name: "Event QR", icon: Calendar },
  { name: "NFC Cards", icon: ContactRound },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProductsDropdownOpen, setIsProductsDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4">
      {/* Floating pill navbar */}
      <div
        className={cn(
          "w-full max-w-3xl transition-all duration-300 rounded-2xl flex items-center justify-between px-4 py-2.5",
          isScrolled
            ? "bg-white/95 backdrop-blur-lg shadow-lg border border-gray-200/80"
            : "bg-white/90 backdrop-blur-md shadow-md border border-gray-200/60"
        )}
      >
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 group">
          <div className="bg-primary text-white p-1.5 rounded-xl group-hover:scale-110 transition-transform">
            <QrCode className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold text-foreground">Stegofy</span>
        </a>

        {/* Desktop Nav — center */}
        <nav className="hidden md:flex items-center gap-6">
          <a href="#" className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors">Home</a>

          <div
            className="relative"
            onMouseEnter={() => setIsProductsDropdownOpen(true)}
            onMouseLeave={() => setIsProductsDropdownOpen(false)}
          >
            <button className="flex items-center gap-1 text-sm font-medium text-foreground/70 hover:text-primary transition-colors py-1">
              Products <ChevronDown className="w-3.5 h-3.5" />
            </button>

            <AnimatePresence>
              {isProductsDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[460px] bg-white rounded-2xl shadow-xl border border-gray-100 p-4 grid grid-cols-2 gap-2"
                >
                  {PRODUCTS_MENU.map((item) => (
                    <a
                      key={item.name}
                      href="#products"
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                      onClick={() => setIsProductsDropdownOpen(false)}
                    >
                      <div className="bg-primary/10 text-primary p-2 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                        <item.icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                    </a>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <a href="#how-it-works" className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors">How It Works</a>
          <a href="#safety" className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors">Safety</a>
        </nav>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-2">
          <a
            href="#products"
            className="bg-primary text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25 hover:-translate-y-0.5 transition-all"
          >
            Sign Up
          </a>
          <a href="#" className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors px-3 py-2">
            Login
          </a>
          <button className="p-2 text-foreground/60 hover:text-primary transition-colors rounded-lg hover:bg-slate-100">
            <Moon className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-2">
          <button className="p-2 text-foreground/60 hover:text-primary transition-colors rounded-lg hover:bg-slate-100">
            <Moon className="w-4 h-4" />
          </button>
          <button
            className="text-foreground p-2 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu — drops below pill */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-[70px] left-4 right-4 max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
          >
            <div className="px-4 py-5 flex flex-col gap-1">
              <a href="#" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-medium px-3 py-2.5 hover:bg-slate-50 rounded-xl">Home</a>
              <a href="#products" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-medium px-3 py-2.5 hover:bg-slate-50 rounded-xl">Products</a>
              <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-medium px-3 py-2.5 hover:bg-slate-50 rounded-xl">How It Works</a>
              <a href="#safety" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-medium px-3 py-2.5 hover:bg-slate-50 rounded-xl">Safety</a>

              <div className="h-px bg-gray-100 my-2" />

              <div className="flex gap-2">
                <a href="#" className="flex-1 text-sm font-medium py-2.5 text-center border border-gray-200 rounded-xl hover:bg-slate-50">Login</a>
                <a href="#products" className="flex-1 text-sm font-semibold py-2.5 text-center bg-primary text-white rounded-xl">Sign Up</a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
