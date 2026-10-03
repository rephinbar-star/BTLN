import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import {
  R360Card,
  R360PatternDetail,
  R360RecommendationCard,
  R360WhatsWorking,
} from "@/components/relationship360/display";
import { DashboardPanel, DashboardPattern, DashboardScope } from "@/components/relationship360/DashboardSections";
import { QUESTION_LABELS } from "@/lib/relationship360/select";
import {
  buildLive,
  getLiveStatus,
  liveState,
  LIVE_STATE_COPY,
  resolveLiveEvidence,
  saveReflection,
  type LiveStatus,
} from "@/lib/relationship360/live";
import type { JourneyRelationship } from "@/lib/journey/types";
import type { LiveComparison } from "@/lib/relationship360/live";
import type { R360Pattern, R360Recommendation, R360Working } from "@/lib/relationship360/types";
import { describeSource, type R360SourceMeta } from "@/lib/relationship360/sourceCoverage";

/**
 * The real profile, built from the person's own confirmed conversations.
 * The fictional preview lives separately at /examples/journey and is never
 * mixed into this view.
 */
/**
 * `recorded`: operator component review of a recorded synthetic test build.
 * Nothing is fetched, built, saved or sent as feedback. Not a customer view.
 */
export const Relationship360Live = ({ relationships, recorded }: { relationships: JourneyRelationship[]; recorded?: LiveStatus }) => {
  const { toast } = useToast();
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [privateNote, setPrivateNote] = useState("");

  const load = useCallback(async () => {
    if (recorded) { setStatus(recorded); setLoading(false); return; }
    setLoading(true);
    try {
      setStatus(await getLiveStatus(relationshipId));
    } catch (error) {
      toast({
        title: "Could not load your Relationship360",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [relationshipId, toast, recorded]);

  useEffect(() => {
    void load();
  }, [load]);

  const state = status ? liveState(status, building) : "no_evidence";
  const content = status?.summary?.content ?? null;
  const observations = status?.observations ?? [];

  const evidenceFor = useCallback(
    (ids: string[]) => resolveLiveEvidence(ids, observations),
    [observations],
  );

  const patterns = useMemo(
    () =>
      (content?.patterns ?? []).map((pattern) => ({
        ...pattern,
        evidence: pattern.evidence.map((id) => ({ sourceId: id, messageId: id })),
      })) as R360Pattern[],
    [content],
  );

  const build = async () => {
    setBuilding(true);
    try {
      const result = await buildLive(relationshipId);
      if (result.state === "complete") toast({ title: "Relationship360 updated" });
      else if (result.state === "no_evidence") toast({ title: "Nothing to build from yet", description: result.message });
      else if (result.state === "cancelled") toast({ title: "Nothing was saved", description: result.message });
      else if (result.state === "updating") toast({ title: "Already updating", description: "This is still building." });
      await load();
    } catch (error) {
      toast({
        title: "The update did not finish",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBuilding(false);
    }
  };

  const savePrivateNote = async () => {
    if (recorded || !privateNote.trim()) return;
    try {
      await saveReflection({ relationshipId, kind: "reflection", text: privateNote.trim() });
      setPrivateNote("");
      toast({ title: "Saved privately" });
      await load();
    } catch (error) { toast({ title: "Could not save your note", description: error instanceof Error ? error.message : undefined, variant: "destructive" }); }
  };

  const submitReflection = async (recommendationId: string, outcome: "used" | "not_used") => {
    if (recorded) return;
    try {
      await saveReflection({
        relationshipId,
        recommendationId,
        kind: "action_outcome",
        text: outcome === "used" ? "I used this." : "I have not used this yet.",
        outcome,
      });
      toast({ title: "Saved privately", description: "Stored as your own account of what happened, separate from observed evidence." });
      await load();
    } catch (error) {
      toast({
        title: "Could not save your reflection",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  if (loading && !status) {
    return (
      <div className="mt-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const coverage = status?.summary?.coverage ?? null;
  const comparison = coverage?.comparison ?? null;

  return (
    <section className="mt-10 min-w-0" aria-labelledby="r360-live">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="r360-live" className="text-[20px] font-medium">Your profile</h2>
        {!recorded && status?.prime && status.opted_in && (
          <Button
            variant="outline"
            className="h-11 rounded-full"
            disabled={building}
            onClick={build}
          >
            {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {content ? "Build again" : "Build my profile"}
          </Button>
        )}
      </div>

      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground" aria-live="polite">
        {LIVE_STATE_COPY[state]}
      </p>

      <DashboardScope value={relationshipId ?? "all"} onChange={(value) => setRelationshipId(value === "all" ? null : value)} options={[{ value: "all", label: "All relationships" }, ...relationships.map((rel) => ({ value: rel.id, label: rel.label }))]} />

      {status && status.counts.pending > 0 && (
        <p className="mt-3 text-[13px] text-muted-foreground">
          {status.counts.pending} linked conversation{status.counts.pending === 1 ? " is" : "s are"} still waiting for you to say which participant is you, so {status.counts.pending === 1 ? "it contributes" : "they contribute"} nothing.
        </p>
      )}

      {content && status?.summary && (
        <FeedbackProvider sourceKind="relationship360" sourceId={status.summary.id} demo={!!recorded}>
          <div className="mt-5 space-y-4">
            <details className="rounded-lg border border-border bg-card px-4 py-2"><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">{coverage?.sources ?? status.sources?.length ?? 0} reads · Source coverage</summary><SourceCoverage sources={status.sources} observations={observations} cited={!!recorded} /><p className="pb-3 text-xs text-muted-foreground">{coverage?.observations ?? observations.length} stored observations · Built {new Date(status.summary.generated_at).toLocaleDateString()}. No raw messages are kept.</p></details>
            <div className="grid gap-4 md:grid-cols-[1.1fr_.9fr] md:items-start"><div className="space-y-4">
              {patterns.length ? <DashboardPattern title={patterns[0].title} statement={patterns[0].statement} sources={[...new Set(patterns[0].evidence.map((ref) => observations.find((item) => item.id === ref.sourceId)?.journey_source_id).filter((id): id is string => Boolean(id)))].flatMap((id) => { const source = status.sources?.find((item) => item.id === id); return source ? [{ id, label: describeSource(source, observations.filter((item) => item.journey_source_id === id).length, !!recorded).kind, href: "#manage-conversations" }] : []; })}>
                <details className="mt-3"><summary className="min-h-11 cursor-pointer content-center underline underline-offset-4">Read the evidence and limits</summary><R360PatternDetail pattern={patterns[0]} evidence={evidenceFor(patterns[0].evidence.map((ref) => ref.sourceId))} questionLabel={QUESTION_LABELS[patterns[0].question]} /></details>
              </DashboardPattern> : <DashboardPanel heading="What keeps showing up"><p className="text-muted-foreground">Not enough source-backed patterns yet.</p></DashboardPanel>}
              <DashboardPanel heading="Insights">{patterns.slice(1, 3).map((pattern) => <details key={pattern.id} className="border-b border-border py-2"><summary className="min-h-11 cursor-pointer content-center font-semibold">{pattern.title}</summary><R360PatternDetail pattern={pattern} evidence={evidenceFor(pattern.evidence.map((ref) => ref.sourceId))} questionLabel={QUESTION_LABELS[pattern.question]} /></details>)}{patterns.length < 2 && <p className="text-muted-foreground">No further source-backed patterns yet.</p>}</DashboardPanel>
            </div><div className="space-y-4">
              <DashboardPanel heading="Suggested next steps">{content.recommendations.length ? content.recommendations.slice(0, 2).map((rec) => <R360RecommendationCard key={rec.id} recommendation={{ ...rec, evidence: [] } as R360Recommendation} evidence={evidenceFor(rec.evidence)} onCheckIn={(value) => void submitReflection(rec.id, value === "yes" ? "used" : "not_used")} />) : <p className="text-muted-foreground">No source-backed next steps yet.</p>}</DashboardPanel>
              <DashboardPanel heading="Introspection"><p>{patterns[0]?.introspection?.openingQuestion ?? "What would you like to understand about these exchanges?"}</p><p className="mt-2 text-xs text-muted-foreground">A question for reflection, not a claim about anyone’s intentions.</p><label htmlFor="r360-private-note" className="mt-4 block">Private optional note</label><textarea id="r360-private-note" value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} maxLength={2000} rows={3} className="mt-2 w-full rounded-md border border-input bg-background p-3 text-base" /><Button className="mt-2 min-h-11" variant="outline" disabled={!privateNote.trim() || !!recorded} onClick={() => void savePrivateNote()}>Save privately</Button></DashboardPanel>
            </div></div>
            <details className="rounded-lg border border-border px-4 py-2"><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">More evidence, changes over time and your notes</summary>
              {content.narrative && <p className="mt-3 whitespace-pre-wrap text-sm">{content.narrative}</p>}
              {(coverage as { evaluation_scope?: string | null } | null)?.evaluation_scope && <p className="mt-3 text-xs">Test build: operator evaluation, not an ordinary Relationship360.</p>}
              <ThenNow comparison={comparison} />
              {patterns.slice(3).map((pattern) => <R360PatternDetail key={pattern.id} pattern={pattern} evidence={evidenceFor(pattern.evidence.map((ref) => ref.sourceId))} questionLabel={QUESTION_LABELS[pattern.question]} />)}
              <R360WhatsWorking items={(content.working ?? []).map((item) => ({ ...item, evidence: [] })) as R360Working[]} evidenceFor={(item) => evidenceFor((content.working ?? []).find((w) => w.id === item.id)?.evidence ?? [])} />
              {content.recommendations.slice(2).map((rec) => <R360RecommendationCard key={rec.id} recommendation={{ ...rec, evidence: [] } as R360Recommendation} evidence={evidenceFor(rec.evidence)} onCheckIn={(value) => void submitReflection(rec.id, value === "yes" ? "used" : "not_used")} />)}
              {(status.reflections ?? []).length > 0 && <section className="mt-5"><h3 className="font-semibold">Your own notes · self-reported</h3><ul className="mt-2 space-y-2">{status.reflections.map((reflection) => <li key={reflection.id} className="rounded-md border border-border p-3 text-sm"><p>{reflection.response_text}</p><p className="text-xs text-muted-foreground">{new Date(reflection.self_reported_at).toLocaleDateString()}</p></li>)}</ul></section>}
            </details>
          </div>
        </FeedbackProvider>
      )}
    </section>
  );
};

/** Compact per-conversation coverage: supplied count, date range and attribution scope. */
const SourceCoverage = ({ sources, observations, cited }: { sources?: R360SourceMeta[]; observations: { journey_source_id?: string }[]; cited?: boolean }) => {
  if (!sources || sources.length === 0) return null;
  return (
    <details className="mt-3 min-w-0 rounded-xl border border-btln-line">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 text-[14px] font-medium">
        Conversations included ({sources.length})
      </summary>
      <ul className="space-y-2 px-3 pb-3">
        {sources.map((s) => {
          const d = describeSource(s, observations.filter((o) => o.journey_source_id === s.id).length, cited);
          return (
            <li key={s.id} className="min-w-0 border-t border-btln-line pt-2 text-[13px] leading-relaxed">
              <p className="break-words"><span className="font-medium">{d.kind}</span> · {d.count}</p>
              <p className="break-words text-muted-foreground">{d.dates}</p>
              <p className="break-words text-muted-foreground">{[d.attribution, d.used].filter(Boolean).join(" · ")}</p>
            </li>
          );
        })}
      </ul>
      <p className="px-3 pb-3 text-[12px] text-muted-foreground">
        Counts are per conversation as supplied; overlapping imports are not merged into one total.
      </p>
    </details>
  );
};

type ComparisonReason = Extract<LiveComparison, { available: false }>["reason"];

const COMPARISON_REASON: Record<ComparisonReason, string> = {
  not_enough_dated_evidence:
    "Then and Now needs conversations that carry their own dates. Nothing included does yet, so no time comparison is shown.",
  single_period: "Everything included falls in one period, so there is nothing to compare it against.",
  same_conversation_only:
    "The dated evidence comes from the same conversation, and one conversation cannot stand on both sides of a comparison.",
  overlapping_periods: "The dated conversations overlap in time, so they are not two separate periods.",
};

/** Two dated periods side by side. Nothing here claims anything improved. */
const ThenNow = ({ comparison }: { comparison: LiveComparison | null | undefined }) => {
  if (!comparison) return null;
  if (comparison.available === false) {
    return (
      <section className="mt-6 min-w-0" aria-labelledby="r360-thennow">
        <h3 id="r360-thennow" className="text-[18px] font-medium">Then and Now</h3>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{COMPARISON_REASON[comparison.reason]}</p>
      </section>
    );
  }
  return (
    <section className="mt-6 min-w-0" aria-labelledby="r360-thennow">
      <h3 id="r360-thennow" className="text-[18px] font-medium">Then and Now</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {([["Then", comparison.then], ["Now", comparison.now]] as const).map(([title, period]) => (
          <div key={title} className="rounded-xl border border-btln-line p-3">
            <p className="text-[14px] font-medium">{title}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {period.start}{period.end !== period.start ? ` – ${period.end}` : ""}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed">
              {period.observations} dated observation{period.observations === 1 ? "" : "s"} from {period.sources} conversation{period.sources === 1 ? "" : "s"}
              {period.about_you + period.about_them > 0
                ? `: ${period.about_you} about you, ${period.about_them} about the other person.`
                : ". None of them could be attributed to a named person, so they describe the exchange rather than either of you."}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">{comparison.note}</p>
    </section>
  );
};
