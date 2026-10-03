import { Heart, House, Users } from "lucide-react";
import quickArt from "@/assets/home-modes/quick-take.webp.asset.json";
import deepArt from "@/assets/home-modes/deep-read.webp.asset.json";
import groupArt from "@/assets/home-modes/group-roast.webp.asset.json";
import relationshipArt from "@/assets/home-modes/relationship360.webp.asset.json";

type Kind = "quick" | "deep" | "group" | "relationship";
const modes = {
  quick: { label: "Quick Take", title: "What did they mean?", lines: ["Possible meanings.", "Three ways to reply."], art: quickArt, color: "text-prism-lavender" },
  deep: { label: "Deep Read", title: "See your patterns.", lines: ["Understand each other.", "Find a better way forward."], art: deepArt, color: "text-prism-emerald-text" },
  group: { label: "Group Roast", title: "Your chat. Roasted.", lines: ["Find the roles.", "Laugh at the habits."], art: groupArt, color: "text-prism-amber-text" },
  relationship: { label: "Your Relationship360", title: "See how you connect.", lines: ["Patterns over time.", "Practical coaching for you."], art: relationshipArt, color: "text-prism-lavender" },
} as const;
export const ModeIntro = ({ kind, example = false }: { kind: Kind; example?: boolean }) => {
  const mode = modes[kind];
  return <section className={`min-w-0 ${kind === "relationship" ? "md:flex md:items-center md:gap-8" : ""}`} aria-labelledby={`${kind}-intro-title`}>
    <img src={mode.art.url} width={560} height={560} alt="" decoding="async" className={`float-right ml-2 h-[118px] w-[118px] object-contain sm:h-36 sm:w-36 md:float-none md:ml-0 ${kind === "relationship" ? "md:order-2 md:h-56 md:w-56" : "md:mb-5 md:h-[260px] md:w-[260px]"}`} />
    <div className="min-w-0">
      <p className={`font-mono text-[11px] font-semibold uppercase ${mode.color}`}>{mode.label}</p>
      <h1 id={`${kind}-intro-title`} className="mt-2 max-w-[14ch] font-display text-[27px] font-bold leading-[1.1] md:text-[39px]">{mode.title}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">{mode.lines[0]}<br />{mode.lines[1]}</p>
      {example && <p className="mt-3 font-mono text-[11px] uppercase text-prism-lavender">Prime · Fictional example · In development</p>}
    </div>
    {kind !== "relationship" && <p className="clear-both flex flex-wrap items-center justify-center gap-3 pt-5 text-xs text-muted-foreground md:justify-start">{kind === "group" ? <><Users className="h-4 w-4" /> 3+ people · Group chats</> : <><span className="flex items-center gap-1"><Heart className="h-4 w-4" /> Dating</span><span className="flex items-center gap-1"><Users className="h-4 w-4" /> Friends</span><span className="flex items-center gap-1"><House className="h-4 w-4" /> Family</span></>}</p>}
  </section>;
};
