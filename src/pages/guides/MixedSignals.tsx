import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/components/marketing/PublicPage";
import { track } from "@/lib/analytics";
export default function MixedSignalsGuide() {
  return <PublicPage title="Understand Mixed-Signal Texts | BetweenTheLines™" description="Use Quick Take to examine a short mixed-signal text exchange and get grounded reply options without uploading a full history." path="/guides/mixed-signal-texts">
    <p className="text-sm text-muted-foreground">Quick Take guide</p><h1 className="mt-3 text-[36px] font-medium leading-tight sm:text-[48px]">When one text sends mixed signals</h1>
    <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">A short message can feel loaded because tone and context are missing. Quick Take focuses on the words in a screenshot or pasted exchange and offers possible readings—not certainty about someone’s motives.</p>
    <section className="mt-10 rounded-lg border border-border bg-card p-6"><p className="text-xs font-semibold uppercase text-muted-foreground">Fictional example</p><p className="mt-3">“This week is chaos. Maybe next weekend?”</p><h2 className="mt-6 text-lg font-medium">A grounded way to read it</h2><p className="mt-2 text-muted-foreground">The message delays the plan but suggests another window. Treat that as interest with low commitment until a specific plan follows.</p><h2 className="mt-5 text-lg font-medium">A practical reply</h2><p className="mt-2 text-muted-foreground">“No stress—want to pick a day next week when things calm down?”</p></section>
    <p className="mt-7 text-sm leading-relaxed text-muted-foreground">Quick Take accepts pasted text or up to three PNG/JPG screenshots. It is for brief context; use Deep Read for a longer two-person history.</p>
    <Button asChild className="mt-7 rounded-full" onClick={() => track("guide_cta_clicked", { guide: "mixed_signals", destination: "quick_take" })}><Link to="/">Get my take</Link></Button>
  </PublicPage>;
}
