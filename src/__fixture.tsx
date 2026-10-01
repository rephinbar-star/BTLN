// TEMPORARY local review fixture — deleted after verification. Fictional data only.
import { createRoot } from "react-dom/client";
import { useRef, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as htmlToImage from "html-to-image";
import "./index.css";
import { Relationship360Live } from "@/components/relationship360/Relationship360Live";
import { RelationshipMap } from "@/components/relationship360/RelationshipMap";
import { GroupRoastShareCard } from "@/components/groupRoast/GroupRoastShareCard";
import { ShareableCard } from "@/components/chemistry/ShareableCard";
import { Button } from "@/components/ui/button";
import { deepResult, deepContext } from "@/lib/examples/fixtures";
import type { LiveStatus } from "@/lib/relationship360/live";

const obs = (id: string, src: string, kind: any, s: string, q: string, sp: string, start: string) => ({ id, journey_source_id: src, subject_kind: kind, subject_label: null, observation_type: "pattern", statement: s, evidence_refs: [{ quote: q, speaker: sp, label: "Message" }], confidence: "medium" as const, observed_period_start: start, observed_period_end: start, created_at: start });
const status: LiveStatus = {
  prime: true, opted_in: true, consent_current: true, counts: { linked: 3, eligible: 3, pending: 1 },
  summary: { id: "fx-sum", scope: "cross_relationship", relationship_id: null, is_stale: false, generated_at: "2026-09-30T10:00:00Z", model: null, evidence_source_ids: ["s1","s2","s3"],
    coverage: { sources: 3, relationships: 2, observations: 6, dated_observations: 6, comparison: { available: true, then: { start: "2026-03-01", end: "2026-04-30", observations: 3, sources: 1, about_you: 2, about_them: 1 }, now: { start: "2026-08-01", end: "2026-09-15", observations: 3, sources: 2, about_you: 1, about_them: 2 }, note: "Fictional comparison: each side describes only its own included conversations." } } as any,
    content: { headline: "Fictional: plans get clearer when you name a time", narrative: "In these fictional conversations, vague plans tended to drift until someone suggested a specific day.",
      takeaways: [{ id: "t1", label: "Specific invitations got quicker replies" }, { id: "t2", label: "Apologies landed when they named the miss" }],
      patterns: [{ id: "p1", question: "repeating", title: "Vague plans drift", statement: "Open-ended 'we should hang out' messages went unanswered twice.", state: "again", observedRange: "Mar–Sep 2026", evidence: ["o1","o4"], confidence: "medium", limitation: "Only three fictional conversations." } as any],
      working: [{ id: "w1", statement: "Both people check in after a hard week.", evidence: ["o2"] } as any],
      recommendations: [{ id: "r1", type: "communication", observation: "Invitations without a time stalled.", action: "Offer two specific times.", why: "It makes saying yes easier.", evidence: ["o1"] } as any] } },
  job: null,
  observations: [obs("o1","s1","user_behavior","You suggested meeting 'sometime'.","we should hang out sometime","You","2026-03-10"), obs("o2","s2","other_behavior","Sam asked how your week went.","how was the week?","Sam","2026-08-05"), obs("o4","s3","user_behavior","You proposed Saturday at 3.","saturday at 3?","You","2026-09-01")] as any,
  reflections: [],
  sources: [{ id: "s1", source_kind: "deep_read", dated_count: 120, undated_count: 0, date_provenance: "parsed", date_precision: "day", observed_period_start: "2026-03-01", observed_period_end: "2026-04-30" }, { id: "s2", source_kind: "quick_take", dated_count: 14, undated_count: 2, date_provenance: "user_supplied", date_precision: "month", observed_period_start: "2026-08-01", observed_period_end: "2026-08-31" }],
};
const rels: any[] = [{ id: "j1", kind: "friend", scope: "pair", label: "Sam (fictional)", is_confirmed: true, data_version: 1, created_at: "" }, { id: "j2", kind: "family", scope: "pair", label: "Mum (fictional)", is_confirmed: true, data_version: 1, created_at: "" }];
const mapRels: any[] = [{ id: "j1", label: "Sam (fictional)", scope: "pair", context: "friend" }, { id: "j2", label: "Mum (fictional)", scope: "pair", context: "family" }, { id: "j3", label: "Book club (fictional)", scope: "group", context: "friend" }];
const role = { participant_id: "a", role: "The Planner", headline: "Has a spreadsheet for brunch.", observed_behavior: "Proposed three dates before anyone replied.", evidence: "ok who's free sat, sun or mon", confidence: "medium" as const };

function App() {
  const [active, setActive] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [fmt, setFmt] = useState<"square" | "story">("square");
  const save = async (f: "square" | "story") => { setFmt(f); await new Promise((r) => setTimeout(r, 120)); const url = await htmlToImage.toPng(ref.current!, { pixelRatio: 1, cacheBust: true }); const a = document.createElement("a"); a.href = url; a.download = `group-roast-${f}.png`; a.click(); };
  return (
    <main className="mx-auto max-w-2xl px-4 pb-24">
      <p className="mt-4 text-xs text-muted-foreground">Local fictional review fixture (not a route).</p>
      <section id="map"><RelationshipMap relationships={mapRels} active={active} onSelect={setActive} countFor={() => 1} /></section>
      <section id="r360"><Relationship360Live relationships={rels} recorded={status} /></section>
      <section id="sharecard" className="mt-10"><ShareableCard result={deepResult as any} context={deepContext as any} /></section>
      <section id="roast" className="mt-10 flex gap-2"><Button variant="outline" size="sm" onClick={() => void save("square")}>1:1</Button><Button variant="outline" size="sm" onClick={() => void save("story")}>9:16</Button></section>
      <div style={{ position: "fixed", left: -99999, top: 0 }}><GroupRoastShareCard ref={ref} format={fmt} label="Sam (fictional)" role={role} /></div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient()}><BrowserRouter><App /></BrowserRouter></QueryClientProvider>);
