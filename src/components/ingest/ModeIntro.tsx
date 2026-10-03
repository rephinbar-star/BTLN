import { Heart, House, Users } from "lucide-react";
import quickArt from "@/assets/home-modes/quick-take.webp.asset.json";
import deepArt from "@/assets/home-modes/deep-read.webp.asset.json";
import groupArt from "@/assets/home-modes/group-roast.webp.asset.json";
import relationshipArt from "@/assets/home-modes/relationship360.webp.asset.json";

type Kind = "quick" | "deep" | "group" | "relationship";
const modes = {
  quick: { label: "Quick Take", title: "What did they mean?", lines: ["Possible meanings.", "Three ways to reply."], art: quickArt, color: "text-prism-lavender", glow: "bg-prism-violet/10" },
  deep: { label: "Deep Read", title: "See your patterns.", lines: ["Understand each other.", "Find a better way forward."], art: deepArt, color: "text-prism-emerald-text", glow: "bg-prism-emerald/10" },
  group: { label: "Group Roast", title: "Your chat. Roasted.", lines: ["Find the roles.", "Laugh at the habits."], art: groupArt, color: "text-prism-amber-text", glow: "bg-prism-amber/10" },
  relationship: { label: "Your Relationship360", title: "See how you connect.", lines: ["Patterns over time.", "Practical coaching for you."], art: relationshipArt, color: "text-prism-lavender", glow: "bg-prism-violet/10" },
} as const;

export const ModeIntro = ({ kind, example = false }: { kind: Kind; example?: boolean }) => {
  const mode = modes[kind];
  return <section className={`relative min-w-0 overflow-hidden rounded-md ${mode.glow} px-1 py-5 sm:px-5 md:bg-transparent md:py-8`} aria-labelledby={`${kind}-intro-title`}>
    <div className="grid grid-cols-[minmax(0,1fr)_38%] items-center gap-2 md:grid-cols-[minmax(0,1fr)_45%] md:gap-8">
      <div className="min-w-0">
        <p className={`font-mono text-[11px] font-semibold uppercase ${mode.color}`}>{mode.label}</p>
        <h1 id={`${kind}-intro-title`} className="mt-3 max-w-[13ch] font-display text-[30px] font-bold leading-[1.08] sm:text-[38px] md:text-[48px]">{mode.title}</h1>
        <p className="mt-4 text-[14px] leading-6 text-muted-foreground sm:text-[16px]">{mode.lines[0]}<br />{mode.lines[1]}</p>
        {kind === "group" && <p className="mt-3 flex items-center gap-1 font-mono text-[11px] text-muted-foreground"><Users className="h-4 w-4" /> 3+ people · Group chats</p>}
        {example && <p className="mt-3 font-mono text-[11px] uppercase text-prism-lavender">Fictional example · In development</p>}
      </div>
      <img src={mode.art.url} width={560} height={560} alt="" decoding="async" className="aspect-square w-full object-contain" />
    </div>
    {kind !== "relationship" && kind !== "group" && <p className="mt-3 flex items-center justify-center gap-4 text-[12px] text-muted-foreground md:justify-start"><span className="flex items-center gap-1"><Heart className="h-4 w-4" /> Dating</span><span className="flex items-center gap-1"><Users className="h-4 w-4" /> Friends</span><span className="flex items-center gap-1"><House className="h-4 w-4" /> Family</span></p>}
  </section>;
};
