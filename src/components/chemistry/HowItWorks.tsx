import { Brain, Heart, MessageCircle } from "lucide-react";

const steps = [
  {
    icon: MessageCircle,
    title: "Drop in your texts",
    body: "Paste a chunk of your conversation. Takes 30 seconds.",
    headerBg: "bg-pastel-pink-bg",
    iconColor: "text-pastel-pink-fg",
  },
  {
    icon: Brain,
    title: "AI reads between the lines",
    body: "We analyse communication style, attachment patterns, love languages, and the green and red flags hiding in plain sight.",
    headerBg: "bg-pastel-purple-bg",
    iconColor: "text-pastel-purple-fg-strong",
  },
  {
    icon: Heart,
    title: "Get your scorecard",
    body: "A single shareable card with your compatibility score and the receipts behind it. Post it, screenshot it, save it.",
    headerBg: "bg-pastel-yellow-bg",
    iconColor: "text-pastel-yellow-fg",
  },
];

export const HowItWorks = () => {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm text-muted-foreground">How it works</p>
        <h2 className="mt-3 max-w-2xl text-[28px] font-medium tracking-tight sm:text-[36px]">
          Three steps. BetweenTheLines, decoded.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
              >
                <div className={`${s.headerBg} flex h-16 items-center px-5`}>
                  <Icon className={`h-5 w-5 ${s.iconColor}`} />
                </div>
                <div className="p-5">
                  <h3 className="text-[17px] font-medium tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};