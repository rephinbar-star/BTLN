import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CoupleTypeCard } from "@/components/CoupleTypeCard";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/components/marketing/PublicPage";
import { track } from "@/lib/analytics";

type SampleKey = "romantic" | "friend" | "family";
const samples = {
  romantic: { label: "Romantic", names: "Maya & Jonas", typeId: 1, pattern: "Plans become unclear when reassurance is implied instead of asked for.", evidence: "Maya asks whether Friday is still happening; Jonas answers the work update but not the plan.", next: "Ask one direct planning question and give a clear time to revisit it." },
  friend: { label: "Friends", names: "Nia & Sam", typeId: 7, pattern: "Both friends show care through practical check-ins, but neither names hurt feelings quickly.", evidence: "After a cancelled plan, both move to logistics before acknowledging disappointment.", next: "Name the feeling briefly before solving the scheduling problem." },
  family: { label: "Family", names: "Rae & Aunt Lina", typeId: 8, pattern: "Advice arrives before the person asking feels fully heard.", evidence: "Rae shares a difficult week; Lina offers three solutions before asking what support would help.", next: "Reflect the concern first, then ask whether advice is wanted." },
} as const;

export default function Sample() {
  const [kind, setKind] = useState<SampleKey>("romantic");
  const item = samples[kind];
  useEffect(() => { track("sample_viewed", { category: kind }); }, [kind]);
  return (
    <PublicPage title="Sample Relationship Report | BetweenTheLines™" description="Explore a clearly fictional BetweenTheLines report for romantic, friendship, and family conversations." path="/sample">
      <p className="text-sm font-medium text-muted-foreground">Fictional demonstration</p>
      <h1 className="mt-3 text-[36px] font-medium leading-tight sm:text-[48px]">See a sample read</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">These examples are synthetic. They show the report format, not a real person or guaranteed outcome.</p>
      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Sample relationship type">
        {(Object.keys(samples) as SampleKey[]).map((key) => <Button key={key} variant={kind === key ? "default" : "outline"} role="tab" aria-selected={kind === key} onClick={() => setKind(key)}>{samples[key].label}</Button>)}
      </div>
      <section className="mt-8" aria-live="polite">
        <p className="text-sm text-muted-foreground">Sample: {item.names}</p>
        <div className="mt-5"><CoupleTypeCard coupleTypeId={item.typeId} relationshipType={kind} size="full" /></div>
        <div className="mt-8 grid gap-4">
          {[['Pattern', item.pattern], ['Released evidence', item.evidence], ['A practical next step', item.next]].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-card p-5"><h2 className="text-sm font-semibold uppercase text-muted-foreground">{label}</h2><p className="mt-2 text-[16px] leading-relaxed">{value}</p></div>)}
        </div>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">BetweenTheLines combines guided imports, a consistent report structure, communication metrics when timestamps support them, practical suggestions, pair types, and sharing controls. It is a reflection tool, not therapy or a factual verdict about anyone.</p>
        <Button asChild className="mt-8 rounded-full" onClick={() => track("sample_cta_clicked", { category: kind, destination: "deep_read" })}><Link to="/deep">Start a Deep Read</Link></Button>
      </section>
    </PublicPage>
  );
}
