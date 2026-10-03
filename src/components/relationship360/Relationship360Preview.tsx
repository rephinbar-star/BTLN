import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ModeIntro } from "@/components/ingest/ModeIntro";
import { AddReadLinks, DashboardPanel, DashboardPattern, DashboardScope } from "@/components/relationship360/DashboardSections";
import { relationship360Preview as data } from "@/lib/relationship360/preview";
import { computeR360View, distinctByMeaning } from "@/lib/relationship360/select";

/** Entirely fictional, local-only illustration; nothing is sent to the account. */
export const Relationship360Preview = () => {
  const [scope, setScope] = useState("all");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const view = useMemo(() => computeR360View(data, new Set(excluded)), [excluded]);
  const visible = view.includedSources.filter((source) => scope === "all" || data.relationships.find((relationship) => relationship.id === source.relationshipId)?.context === scope);
  const patterns = distinctByMeaning(view.patterns.filter((pattern) => pattern.evidence.some((ref) => visible.some((source) => source.id === ref.sourceId))));
  const featured = patterns[0];
  const featuredSources = featured ? [...new Set(featured.evidence.map((ref) => ref.sourceId))].flatMap((id) => { const source = visible.find((item) => item.id === id); return source ? [{ id, label: source.product, date: source.observedRange }] : []; }) : [];
  const insights = patterns.slice(1, 3);
  const recommendations = distinctByMeaning(view.recommendations.filter((rec) => rec.evidence.some((ref) => visible.some((source) => source.id === ref.sourceId)))).slice(0, 2);
  return <div className="space-y-5">
    <ModeIntro kind="relationship" example />
    <p className="text-xs text-muted-foreground">Fictional example only. Not a real account or available subscription.</p>
    <DashboardScope value={scope} onChange={setScope} options={[{ value: "all", label: "All relationships" }, { value: "romantic", label: "Romantic" }, { value: "friend", label: "Friends" }, { value: "family", label: "Family" }]} />
    <details className="rounded-lg border border-border bg-card px-4 py-2"><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">{visible.length} reads · Manage sources</summary><ul className="space-y-2 pb-3">{data.sources.map((source) => <li key={source.id} className="flex min-h-11 items-center justify-between gap-3 border-t border-border text-sm"><span>{source.product} · {source.observedRange}</span><Button type="button" variant="ghost" className="min-h-11" onClick={() => setExcluded((current) => current.includes(source.id) ? current.filter((id) => id !== source.id) : [...current, source.id])}>{excluded.includes(source.id) ? "Include" : "Exclude"}</Button></li>)}</ul></details>
    <div className="grid gap-4 md:grid-cols-[1.1fr_.9fr] md:items-start"><div className="space-y-4">{featured ? <DashboardPattern title={featured.title} statement={featured.statement} sources={featuredSources}><details className="mt-4"><summary className="min-h-11 cursor-pointer content-center underline underline-offset-4">Read the evidence</summary><p className="text-muted-foreground">{featured.limitation}</p><ul className="mt-2 space-y-2">{featured.evidence.slice(0, 3).map((ref) => { const source = visible.find((item) => item.id === ref.sourceId); const message = source?.messages.find((item) => item.id === ref.messageId); return message ? <li key={`${ref.sourceId}-${ref.messageId}`} className="font-quote text-[15px] italic leading-[22px]">“{message.text}” — {message.sender}</li> : null; })}</ul></details></DashboardPattern> : <DashboardPanel heading="What keeps showing up"><p className="text-muted-foreground">Not enough included reads with references in this scope yet.</p></DashboardPanel>}
    <DashboardPanel heading="Insights">{insights.length ? <ul className="space-y-3">{insights.map((item) => <li key={item.id}><strong>{item.title}</strong><p className="text-muted-foreground">{item.statement}</p></li>)}</ul> : <p className="text-muted-foreground">No other source-backed patterns here yet.</p>}</DashboardPanel></div>
    <div className="space-y-4"><DashboardPanel heading="Suggested next steps">{recommendations.length ? <ul className="space-y-3">{recommendations.map((item) => <li key={item.id}><strong>{item.title}</strong><p className="text-muted-foreground">{item.action}</p></li>)}</ul> : <p className="text-muted-foreground">More context is needed for suggestions.</p>}</DashboardPanel>
    <DashboardPanel heading="Introspection"><p>{featured?.introspection?.openingQuestion ?? "What would you want to understand about this exchange?"}</p><p className="mt-2 text-xs text-muted-foreground">A question for reflection, not a claim about anyone’s intentions.</p><label className="mt-4 block text-sm" htmlFor="demo-private-note">Private optional note</label><textarea id="demo-private-note" value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 w-full rounded-md border border-input bg-background p-3 text-base" rows={3} /><Button type="button" variant="outline" className="mt-2 min-h-11" onClick={() => { setSavedNote(note); setNote(""); }}>Save note in this example</Button>{savedNote && <p className="mt-2 text-xs text-muted-foreground">Saved on this page only; not in an account.</p>}</DashboardPanel></div></div>
    <AddReadLinks className="border-t border-border pt-5" /><p className="text-xs text-muted-foreground">Prime preview · In development — not available to buy. <Link className="underline" to="/prime">Explore preview</Link></p>
  </div>;
};
