import { useState, useEffect } from "react";
import { 
  Menu, X, QrCode, ShoppingCart, ChevronDown, 
  Car, Heart, Cross, Shield, Briefcase, CreditCard, Home, Calendar, ContactRound 
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
    <header
      className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300",
        isScrolled 
          ? "bg-white/80 backdrop-blur-lg shadow-sm border-b border-gray-100 py-3" 
          : "bg-transparent py-5"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 group">
            <div className="bg-primary text-white p-1.5 rounded-lg group-hover:scale-110 transition-transform">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-gradient">Stegofy</span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Home</a>
            
            {/* Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => setIsProductsDropdownOpen(true)}
              onMouseLeave={() => setIsProductsDropdownOpen(false)}
            >
              <button className="flex items-center gap-1 text-sm font-medium text-foreground/80 hover:text-primary transition-colors py-2">
                Products <ChevronDown className="w-4 h-4" />
              </button>
              
              <AnimatePresence>
                {isProductsDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-1/2 -translate-x-1/2 w-[480px] bg-white rounded-2xl shadow-xl border border-gray-100 p-4 grid grid-cols-2 gap-2"
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

            <a href="#how-it-works" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">How It Works</a>
            <a href="#safety" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Safety</a>
          </nav>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-4">
            <a href="#" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Login</a>
            <a href="#products" className="bg-gradient-primary px-5 py-2.5 rounded-full text-sm font-medium hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all">
              Sign Up
            </a>
            <button className="relative p-2 text-foreground hover:text-primary transition-colors">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                0
              </span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-4">
            <button className="relative p-2 text-foreground">
              <ShoppingCart className="w-5 h-5" />
            </button>
            <button 
              className="text-foreground p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-gray-100 overflow-hidden"
          >
            <div className="px-4 py-6 flex flex-col gap-4">
              <a href="#" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium p-2 hover:bg-slate-50 rounded-lg">Home</a>
              <a href="#products" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium p-2 hover:bg-slate-50 rounded-lg">Products</a>
              <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium p-2 hover:bg-slate-50 rounded-lg">How It Works</a>
              <a href="#safety" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium p-2 hover:bg-slate-50 rounded-lg">Safety</a>
              
              <div className="h-px bg-gray-100 my-2"></div>
              
              <a href="#" className="text-base font-medium p-2 text-center border border-gray-200 rounded-xl hover:bg-slate-50">Login</a>
              <a href="#products" className="text-base font-medium p-2 text-center bg-primary text-white rounded-xl">Sign Up</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
