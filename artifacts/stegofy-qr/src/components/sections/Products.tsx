import { ShoppingCart } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const PRODUCTS = [
  {
    name: "Pet QR Tag (Stainless Steel)",
    desc: "Durable, waterproof tag. Never fades.",
    price: "₹499",
    image: `${import.meta.env.BASE_URL}images/product-pet.png`,
    badge: "Most Popular",
    color: "bg-orange-50"
  },
  {
    name: "Car Dashboard Smart Card",
    desc: "Heat resistant acrylic card for dashboards.",
    price: "₹399",
    image: `${import.meta.env.BASE_URL}images/product-car.png`,
    color: "bg-blue-50"
  },
  {
    name: "Medical Alert Bracelet",
    desc: "Comfortable silicone band with metal QR plate.",
    price: "₹599",
    image: `${import.meta.env.BASE_URL}images/product-medical.png`,
    color: "bg-red-50"
  },
  {
    name: "Kids Safety Wristband",
    desc: "Soft, adjustable band. Hard to take off accidentally.",
    price: "₹499",
    image: `${import.meta.env.BASE_URL}images/product-kids.png`,
    color: "bg-green-50"
  },
  {
    name: "Smart QR Sticker Pack (x5)",
    desc: "Vinyl waterproof stickers for laptops, bags, helmets.",
    price: "₹299",
    image: `${import.meta.env.BASE_URL}images/product-stickers.png`,
    color: "bg-purple-50"
  }
];

export function Products() {
  return (
    <section id="buy" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <FadeIn className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Choose Your <span className="text-gradient">Smart Tag</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Premium quality materials built to last. All tags come with free lifetime digital profile access.
            </p>
          </FadeIn>
        </div>

        {/* Scrollable on mobile, Grid on desktop */}
        <div className="flex overflow-x-auto pb-8 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 snap-x">
          {PRODUCTS.map((product, index) => (
            <FadeIn key={index} delay={index * 0.1} className="snap-start shrink-0 w-[280px] sm:w-auto h-full">
              <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col h-full">
                
                {/* Image Area */}
                <div className={`h-48 relative overflow-hidden ${product.color} flex items-center justify-center p-6`}>
                  {product.badge && (
                    <div className="absolute top-3 right-3 bg-gradient-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10">
                      {product.badge}
                    </div>
                  )}
                  {/* Using generated images via BASE_URL. Fallback to nice scaling effect. */}
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      // Fallback if image fails to load during dev
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.classList.add('bg-gradient-to-br', 'from-slate-200', 'to-slate-100');
                    }}
                  />
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-slate-900 mb-1 leading-tight">{product.name}</h3>
                  <p className="text-sm text-slate-500 mb-4 flex-1">{product.desc}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                    <span className="text-xl font-bold text-slate-900">{product.price}</span>
                    <button className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-primary transition-colors hover:shadow-lg hover:-translate-y-0.5">
                      <ShoppingCart className="w-5 h-5" />
                    </button>
                  </div>
                </div>

              </div>
            </FadeIn>
          ))}
        </div>

      </div>
    </section>
  );
}
