import { FadeIn } from "@/components/ui/FadeIn";
import { Quote } from "lucide-react";

const SCENARIOS = [
  {
    emoji: "🐕",
    title: "Lost Pet Found Quickly",
    story: "My Golden Retriever slipped out the gate. A neighbor found him 20 mins later, scanned the tag, and the masked call connected straight to my wife's phone.",
    user: "Rahul M., Mumbai",
    color: "border-l-rose-500"
  },
  {
    emoji: "🚗",
    title: "Parking Conflict Avoided",
    story: "I had to double park for an emergency. The blocked driver scanned my dashboard card and called me. I moved my car instantly without any shouting or police.",
    user: "Vikram S., Delhi",
    color: "border-l-blue-500"
  },
  {
    emoji: "🎒",
    title: "Lost Luggage Recovered",
    story: "Airline lost my bag in transit. A ground staff member in Dubai scanned the QR tag and WhatsApped me. Bag was rerouted to my hotel the next day.",
    user: "Priya K., Bangalore",
    color: "border-l-purple-500"
  },
  {
    emoji: "👴",
    title: "Medical Emergency Helper",
    story: "My grandfather fainted during his walk. Paramedics scanned his bracelet, saw his diabetes history and called me immediately. It saved precious time.",
    user: "Anita D., Pune",
    color: "border-l-red-500"
  }
];

export function Scenarios() {
  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Built for <span className="text-primary">Real-Life Situations</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              See how StegoTags smart tags are helping people solve everyday problems safely.
            </p>
          </FadeIn>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SCENARIOS.map((item, index) => (
            <FadeIn key={index} delay={index * 0.1}>
              <div className={`bg-white rounded-2xl p-8 shadow-sm border border-slate-100 border-l-[6px] ${item.color} relative hover:shadow-md transition-shadow`}>
                <Quote className="absolute top-6 right-8 w-12 h-12 text-slate-100 rotate-180" />
                <div className="text-4xl mb-4">{item.emoji}</div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600 mb-6 italic relative z-10 leading-relaxed">
                  "{item.story}"
                </p>
                <p className="text-sm font-semibold text-slate-900">— {item.user}</p>
              </div>
            </FadeIn>
          ))}
        </div>

      </div>
    </section>
  );
}
