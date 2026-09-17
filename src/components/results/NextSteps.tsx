import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PrimeOffer } from "@/components/prime/PrimeOffer";

type Mode = "quick" | "deep" | "group" | "roast";

const REPEAT: Record<Mode, { to: string; label: string }> = {
  quick: { to: "/quick", label: "Read another text" },
  deep: { to: "/deep", label: "Read another conversation" },
  group: { to: "/group", label: "Read another group chat" },
  roast: { to: "/roast", label: "Roast another chat" },
};

const CROSS: Record<Mode, { to: string; title: string; body: string }> = {
  quick: {
    to: "/deep",
    title: "Does the same thing keep happening between you?",
    body: "A Deep Read looks at the whole conversation, not one message.",
  },
  deep: {
    to: "/group",
    title: "Got a group chat too?",
    body: "A Group Read shows who holds the chat together and who drifts.",
  },
  group: {
    to: "/deep",
    title: "Want the two-person version?",
    body: "A Deep Read goes into one relationship in depth.",
  },
  roast: {
    to: "/group",
    title: "Want the serious version?",
    body: "A Group Read looks at the same chat without the jokes.",
  },
};

/**
 * Contextual follow-through shown after a result is delivered:
 * repeat the same mode, one relevant cross-sell, and the Prime offer
 * (hidden for members by PrimeOffer itself).
 */
export const NextSteps = ({ mode }: { mode: Mode }) => {
  const repeat = REPEAT[mode];
  const cross = CROSS[mode];
  return (
    <section className="mx-auto mt-10 flex max-w-2xl flex-col gap-3 px-5 pb-14 sm:px-8">
      <h2 className="text-[18px] font-medium tracking-tight">What next?</h2>
      <Link
        to={repeat.to}
        className="flex min-h-[56px] items-center justify-between gap-3 rounded-[20px] border border-btln-line bg-card p-[18px] text-[15px] font-medium hover:bg-muted/40"
      >
        {repeat.label}
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
      <Link
        to={cross.to}
        className="flex min-h-[56px] items-start justify-between gap-3 rounded-[20px] border border-btln-line bg-card p-[18px] hover:bg-muted/40"
      >
        <span>
          <span className="block text-[15px] font-medium">{cross.title}</span>
          <span className="mt-1 block text-[14px] text-muted-foreground">{cross.body}</span>
        </span>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
      <PrimeOffer />
    </section>
  );
};
