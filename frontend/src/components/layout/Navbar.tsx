import { useState, useEffect } from "react";
import {
  Menu, X, ChevronDown,
  Car, Heart, Cross, Shield, Briefcase, CreditCard, Home, Calendar, ContactRound,
  ShoppingCart, FileText, ShieldCheck, RefreshCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { BrandIcon, BrandLogo } from "@/components/Brand";

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

const ABOUT_MENU = [
  { name: "Privacy Policy", icon: ShieldCheck, href: "/privacy" },
  { name: "Terms & Conditions", icon: FileText, href: "/terms" },
  { name: "Refund Policy", icon: RefreshCcw, href: "/terms#refund" },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [mobileAboutOpen, setMobileAboutOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinkCls = "text-sm font-medium text-foreground/70 hover:text-primary transition-colors";
  const mobileLinkCls = "text-sm font-medium px-3 py-2.5 hover:bg-slate-50 rounded-xl w-full text-left";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4">
      {/* Floating pill navbar */}
      <div
        className={cn(
          "w-full max-w-[1400px] transition-all duration-300 rounded-2xl flex items-center justify-between px-6 py-2.5",
          isScrolled
            ? "bg-white/95 backdrop-blur-lg shadow-lg border border-gray-200/80"
            : "bg-white/90 backdrop-blur-md shadow-md border border-gray-200/60"
        )}
      >
        {/* Logo */}
        <a href="#" className="flex items-center group flex-shrink-0 transition-transform group-hover:scale-105">
          <BrandLogo height={32} className="hidden sm:block" />
          <BrandIcon size={32} className="sm:hidden" />
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-4">
          <a href="#" className={navLinkCls}>Home</a>

          {/* Products dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setIsProductsOpen(true)}
            onMouseLeave={() => setIsProductsOpen(false)}
          >
            <button className={cn(navLinkCls, "flex items-center gap-1 py-1")}>
              Products <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isProductsOpen && "rotate-180")} />
            </button>
            <AnimatePresence>
              {isProductsOpen && (
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
                      onClick={() => setIsProductsOpen(false)}
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

          <a href="#how-it-works" className={navLinkCls}>How It Works</a>
          <a href="#features" className={navLinkCls}>Features</a>
          <a href="#faqs" className={navLinkCls}>FAQs</a>
          <a href="#partner" className={navLinkCls}>Partner With Us</a>

          {/* About Us dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setIsAboutOpen(true)}
            onMouseLeave={() => setIsAboutOpen(false)}
          >
            <button className={cn(navLinkCls, "flex items-center gap-1 py-1")}>
              About Us <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isAboutOpen && "rotate-180")} />
            </button>
            <AnimatePresence>
              {isAboutOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18 }}
                  className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 p-2"
                >
                  {ABOUT_MENU.map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                      onClick={() => setIsAboutOpen(false)}
                    >
                      <div className="bg-primary/10 text-primary p-1.5 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                        <item.icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                    </a>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <a href="#contact" className={navLinkCls}>Contact Us</a>
        </nav>

        {/* Right Actions — desktop */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <a
            href="/app/signup"
            className="bg-primary text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25 hover:-translate-y-0.5 transition-all"
          >
            Sign Up
          </a>
          <a href="/app/login" className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors px-3 py-2">
            Login
          </a>
          <button className="p-2 text-foreground/60 hover:text-primary transition-colors rounded-lg hover:bg-slate-100" aria-label="Cart">
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile controls */}
        <div className="md:hidden flex items-center gap-1.5">
          <a href="/app/login" className="text-xs font-medium text-foreground/70 hover:text-primary transition-colors px-2 py-1.5">Login</a>
          <a href="/app/signup" className="text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap">Sign Up</a>
          <button className="p-2 text-foreground/60 hover:text-primary transition-colors rounded-lg hover:bg-slate-100" aria-label="Cart">
            <ShoppingCart className="w-4 h-4" />
          </button>
          <button
            className="text-foreground p-2 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-[70px] left-4 right-4 max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-0.5">
              <a href="#" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkCls}>Home</a>

              {/* Products accordion */}
              <div>
                <button
                  className={cn(mobileLinkCls, "flex items-center justify-between")}
                  onClick={() => setMobileProductsOpen(!mobileProductsOpen)}
                >
                  <span>Products</span>
                  <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", mobileProductsOpen && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {mobileProductsOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-3 pb-1 flex flex-col gap-0.5">
                        {PRODUCTS_MENU.map((item) => (
                          <a
                            key={item.name}
                            href="#products"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl text-sm font-medium text-foreground/70"
                          >
                            <div className="bg-primary/10 text-primary p-1.5 rounded-lg">
                              <item.icon className="w-3.5 h-3.5" />
                            </div>
                            {item.name}
                          </a>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkCls}>How It Works</a>
              <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkCls}>Features</a>
              <a href="#faqs" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkCls}>FAQs</a>
              <a href="#partner" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkCls}>Partner With Us</a>

              {/* About Us accordion */}
              <div>
                <button
                  className={cn(mobileLinkCls, "flex items-center justify-between")}
                  onClick={() => setMobileAboutOpen(!mobileAboutOpen)}
                >
                  <span>About Us</span>
                  <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", mobileAboutOpen && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {mobileAboutOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-3 pb-1 flex flex-col gap-0.5">
                        {ABOUT_MENU.map((item) => (
                          <a
                            key={item.name}
                            href={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl text-sm font-medium text-foreground/70"
                          >
                            <div className="bg-primary/10 text-primary p-1.5 rounded-lg">
                              <item.icon className="w-3.5 h-3.5" />
                            </div>
                            {item.name}
                          </a>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <a href="#contact" onClick={() => setIsMobileMenuOpen(false)} className={mobileLinkCls}>Contact Us</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
