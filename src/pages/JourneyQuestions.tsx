import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import { Button } from "@/components/ui/button";
import { QuestionsView, type QuestionNote, type QuestionSource } from "@/components/relationship360/QuestionsView";
import { getLiveStatus, type LiveStatus } from "@/lib/relationship360/live";
import { askPatterns, askScopeKey, type AskResult } from "@/lib/relationship360/ask";

const KIND: Record<string, string> = { quick_take: "Quick Take", deep_read: "Deep Read", group_read: "Group Read", group_roast: "Group Roast" };
type SourceMeta = { id: string; version?: string | null; source_kind: string; relationship_id?: string; relationship_label?: string | null; observed_period_start?: string | null; observed_period_end?: string | null };

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="prime-page min-h-screen bg-background text-foreground">
    <Helmet>
      <title>Ask about your patterns — Relationship360</title>
      <meta name="robots" content="noindex" />
    </Helmet>
    <Header />
    {children}
    <Footer />
  </div>
);

const Notice = ({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) => (
  <Shell>
    <main className="mx-auto max-w-[640px] px-[15px] py-10">
      <h1 className="font-display text-[26px] font-bold">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-5 flex flex-wrap gap-3">{action}<Button asChild variant="outline" className="min-h-11"><Link to="/journey">Back to Relationship360</Link></Button></div>
    </main>
  </Shell>
);

export default function JourneyQuestions() {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [question, setQuestion] = useState("What keeps repeating?");
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<AskResult | null>(null);
  const [askedQuestion, setAskedQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [noteChoice, setNoteChoice] = useState<Record<string, boolean>>({});
  const seq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const answerScope = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try { setStatus(await getLiveStatus(null)); setLoadError(null); }
    catch { setLoadError("We could not load your Relationship360 right now."); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  // Returning to the tab re-checks sources and consent so removed evidence never stays visible.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  const sources = useMemo(() => ((status?.sources ?? []) as SourceMeta[]), [status]);
  const eligibleIds = useMemo(() => sources.map((s) => s.id), [sources]);
  useEffect(() => {
    setSelected((cur) => { const kept = cur.filter((id) => eligibleIds.includes(id)); return kept.length ? kept : eligibleIds.slice(0, 12); });
  }, [eligibleIds]);

  // Notes eligible for this question: from the selected reads' relationships, newest first, capped.
  const relIds = useMemo(() => new Set(sources.filter((s) => selected.includes(s.id)).map((s) => s.relationship_id)), [sources, selected]);
  const eligibleNotes = useMemo(() => (status?.reflections ?? [])
    .filter((r) => r.relationship_id && relIds.has(r.relationship_id)).slice(0, 8), [status, relIds]);
  // Default: eligible notes ticked; any note can be unticked for this question only.
  const selectedNotes = eligibleNotes.filter((n) => noteChoice[n.id] !== false).map((n) => n.id);

  const scope = askScopeKey({
    optedIn: !!status?.opted_in, consentCurrent: !!status?.consent_current,
    sources: sources.map((s) => ({ id: s.id, version: s.version ?? null })), selected,
    notes: (status?.reflections ?? []).map((r) => ({ id: r.id, updated_at: r.updated_at ?? null, response_text: r.response_text })),
    selectedNotes,
  });
  const invalidate = useCallback(() => {
    seq.current += 1; abortRef.current?.abort(); abortRef.current = null;
    answerScope.current = null; setResult(null); setAsking(false); setError(null);
  }, []);
  // Any scope change (refresh, reads, notes, identity, content versions) cancels and clears.
  useEffect(() => {
    if (answerScope.current !== null && answerScope.current !== scope) invalidate();
  }, [scope, invalidate]);
  useEffect(() => () => abortRef.current?.abort(), []);
  const onQuestion = (q: string) => { setQuestion(q); if (answerScope.current !== null || asking) invalidate(); };

  const ask = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    const id = ++seq.current;
    answerScope.current = scope;
    setAsking(true); setError(null); setResult(null); setAskedQuestion(question.trim());
    try {
      const r = await askPatterns(question.trim(), selected, selectedNotes, ctrl.signal);
      if (id !== seq.current) return;
      setResult(r);
    } catch (e) {
      if (id !== seq.current) return;
      setError(e instanceof Error ? e.message : "We could not get an answer right now. Nothing was saved.");
    } finally {
      if (id === seq.current) setAsking(false);
    }
  };

  if (loadError) return <Notice title="Ask about your patterns" body={loadError} action={<Button className="min-h-11" onClick={() => void refresh()}>Try again</Button>} />;
  if (!status) return <Shell><main className="mx-auto max-w-[640px] px-[15px] py-10 text-muted-foreground" aria-busy="true">Loading…</main></Shell>;
  if (!status.prime) return <Notice title="Ask about your patterns" body="Questions are part of Relationship360, which is in Prime. Prime is in development and not available to buy yet." action={<Button asChild className="min-h-11"><Link to="/examples/relationship360/questions">See a fictional example</Link></Button>} />;
  if (!status.opted_in) return <Notice title="Relationship360 is off" body="Turn Relationship360 on and choose which reads contribute before asking questions." />;
  if (!status.consent_current) return <Notice title="Confirm your consent" body="Confirm the current Relationship360 consent on your profile before asking questions." />;
  if (eligibleIds.length === 0) return <Notice title="Nothing included yet" body="No confirmed, included reads contribute yet, so there is nothing to ask about. Confirm which participant is you in a saved read to begin." />;

  const qs: QuestionSource[] = sources.map((s) => ({
    id: s.id,
    label: `${KIND[s.source_kind] ?? "Read"}${s.relationship_label ? ` · ${s.relationship_label}` : ""}`,
    detail: s.observed_period_start ? `${s.observed_period_start.slice(0, 10)}${s.observed_period_end && s.observed_period_end.slice(0, 10) !== s.observed_period_start.slice(0, 10) ? ` – ${s.observed_period_end.slice(0, 10)}` : ""}` : "Date not recorded",
  }));
  const qn: QuestionNote[] = eligibleNotes.map((n) => ({ id: n.id, label: `My reflection · ${n.self_reported_at.slice(0, 10)}`, excerpt: n.response_text.slice(0, 120) }));
  const noteCount = selectedNotes.length;

  return (
    <Shell>
      <QuestionsView
        question={question}
        onQuestion={onQuestion}
        onAsk={() => void ask()}
        asking={asking}
        canAsk={question.trim().length >= 3 && selected.length > 0}
        sources={qs}
        selected={selected}
        onToggleSource={(id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 12 ? cur : [...cur, id]))}
        notes={qn}
        selectedNotes={selectedNotes}
        onToggleNote={(id) => setNoteChoice((c) => ({ ...c, [id]: c[id] === false }))}
        sourceSummary={`Based on ${selected.length} read${selected.length === 1 ? "" : "s"} and ${noteCount} note${noteCount === 1 ? "" : "s"}`}
        result={result}
        askedQuestion={askedQuestion}
        error={error}
      />
    </Shell>
  );
}
