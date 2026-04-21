import { QrCode, Twitter, Instagram, Facebook, Linkedin, ArrowRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#0F172A] text-slate-300 pt-20 pb-10 border-t border-white/10 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          
          {/* Column 1: Brand */}
          <div className="flex flex-col gap-6">
            <a href="#" className="flex items-center gap-2">
              <div className="bg-primary text-white p-1.5 rounded-lg">
                <QrCode className="w-6 h-6" />
              </div>
              <span className="text-2xl font-bold text-white">Stegofy</span>
            </a>
            <p className="text-sm text-slate-400 leading-relaxed">
              Protecting your vehicles, pets, loved ones, and belongings with secure, instant-connect QR technology.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary hover:text-white transition-all"><Twitter className="w-4 h-4" /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary hover:text-white transition-all"><Instagram className="w-4 h-4" /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary hover:text-white transition-all"><Facebook className="w-4 h-4" /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary hover:text-white transition-all"><Linkedin className="w-4 h-4" /></a>
            </div>
          </div>

          {/* Column 2: Products */}
          <div>
            <h4 className="text-white font-semibold mb-6">Use Cases</h4>
            <ul className="flex flex-col gap-3">
              {['Vehicle Parking Tags', 'Pet ID Tags', 'Medical Alert Tags', 'Child Safety Bands', 'Luggage Tags', 'NFC Business Cards'].map((item) => (
                <li key={item}>
                  <a href="#products" className="text-sm text-slate-400 hover:text-primary transition-colors flex items-center gap-2 group">
                    <ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Company */}
          <div>
            <h4 className="text-white font-semibold mb-6">Company</h4>
            <ul className="flex flex-col gap-3">
              {['How It Works', 'Trust & Safety', 'Partner With Us', 'About Us', 'Blog', 'Contact Support'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-slate-400 hover:text-primary transition-colors flex items-center gap-2 group">
                    <ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Legal & Newsletter */}
          <div>
            <h4 className="text-white font-semibold mb-6">Stay Updated</h4>
            <p className="text-sm text-slate-400 mb-4">Subscribe to our newsletter for the latest security tips and product updates.</p>
            <form className="flex gap-2 mb-8">
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-primary w-full"
              />
              <button className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Subscribe
              </button>
            </form>
            <ul className="flex flex-col gap-3">
              {['Privacy Policy', 'Terms of Service', 'Refund Policy'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors underline decoration-white/20 underline-offset-4">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Stegofy QR. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            Powered by <span className="font-semibold text-slate-300">Stegofy</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
