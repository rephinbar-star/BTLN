import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import {
  R360Card,
  R360Overview,
  R360PatternDetail,
  R360RecommendationCard,
  R360WhatsWorking,
} from "@/components/relationship360/display";
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

/**
 * The real profile, built from the person's own confirmed conversations.
 * The fictional preview lives separately at /examples/journey and is never
 * mixed into this view.
 */
export const Relationship360Live = ({ relationships }: { relationships: JourneyRelationship[] }) => {
  const { toast } = useToast();
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [reflectFor, setReflectFor] = useState<string | null>(null);
  const [reflectText, setReflectText] = useState("");

  const load = useCallback(async () => {
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
  }, [relationshipId, toast]);

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

  const submitReflection = async (recommendationId: string, outcome: "used" | "not_used") => {
    try {
      await saveReflection({
        relationshipId,
        recommendationId,
        kind: "action_outcome",
        text: reflectText.trim() || (outcome === "used" ? "I used this." : "I have not used this yet."),
        outcome,
      });
      setReflectFor(null);
      setReflectText("");
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
        {status?.prime && status.opted_in && (
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

      {relationships.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Relationships">
          <button
            type="button"
            aria-pressed={relationshipId === null}
            onClick={() => setRelationshipId(null)}
            className={`min-h-11 rounded-full border px-4 text-[14px] ${relationshipId === null ? "border-foreground bg-foreground text-background" : "border-btln-line text-muted-foreground"}`}
          >
            Everyone
          </button>
          {relationships.map((rel) => (
            <button
              key={rel.id}
              type="button"
              aria-pressed={relationshipId === rel.id}
              onClick={() => setRelationshipId(rel.id)}
              className={`min-h-11 rounded-full border px-4 text-[14px] ${relationshipId === rel.id ? "border-foreground bg-foreground text-background" : "border-btln-line text-muted-foreground"}`}
            >
              {rel.label}
            </button>
          ))}
        </div>
      )}

      {status && status.counts.pending > 0 && (
        <p className="mt-3 text-[13px] text-muted-foreground">
          {status.counts.pending} linked conversation{status.counts.pending === 1 ? " is" : "s are"} still waiting for you to say which participant is you, so {status.counts.pending === 1 ? "it contributes" : "they contribute"} nothing.
        </p>
      )}

      {content && status?.summary && (
        <FeedbackProvider sourceKind="relationship360" sourceId={status.summary.id}>
          <div className="mt-6">
            <R360Overview
              headline={content.headline}
              takeaways={content.takeaways}
              counts={{
                sources: coverage?.sources ?? 0,
                relationships: coverage?.relationships ?? 0,
                periods: 1,
              }}
            />
            {content.narrative && (
              <R360Card className="mt-4">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{content.narrative}</p>
              </R360Card>
            )}
            <p className="mt-3 text-[12px] text-muted-foreground">
              Built {new Date(status.summary.generated_at).toLocaleString()} from {coverage?.observations ?? 0} stored observations. No raw messages are kept.
            </p>

            <ThenNow comparison={comparison} />

            {patterns.map((pattern) => (
              <R360PatternDetail
                key={pattern.id}
                pattern={pattern}
                evidence={evidenceFor(pattern.evidence.map((ref) => ref.sourceId))}
                questionLabel={QUESTION_LABELS[pattern.question]}
              />
            ))}

            <R360WhatsWorking
              items={(content.working ?? []).map((item) => ({ ...item, evidence: [] })) as R360Working[]}
              evidenceFor={(item) =>
                evidenceFor((content.working ?? []).find((w) => w.id === item.id)?.evidence ?? [])
              }
            />

            <section className="mt-8 min-w-0">
              <h3 className="text-[18px] font-medium">Suggestions for next time</h3>
              {content.recommendations.length === 0 ? (
                <p className="mt-2 text-[14px] text-muted-foreground">
                  Nothing here needs changing on this evidence. What is working is above.
                </p>
              ) : (
                content.recommendations.map((rec) => (
                  <div key={rec.id}>
                    <R360RecommendationCard
                      recommendation={{ ...rec, evidence: [] } as R360Recommendation}
                      evidence={evidenceFor(rec.evidence)}
                      onCheckIn={(value) => {
                        setReflectFor(rec.id);
                        setReflectText("");
                        void submitReflection(rec.id, value === "yes" ? "used" : "not_used");
                      }}
                    />
                    {reflectFor === rec.id && (
                      <R360Card className="mt-2">
                        <label className="text-[14px] font-medium" htmlFor={`reflect-${rec.id}`}>
                          What happened? (private, self-reported)
                        </label>
                        <textarea
                          id={`reflect-${rec.id}`}
                          value={reflectText}
                          onChange={(event) => setReflectText(event.target.value)}
                          maxLength={2000}
                          rows={3}
                          className="mt-2 w-full rounded-xl border border-btln-line bg-background p-3 text-[15px]"
                        />
                        <Button
                          className="mt-2 h-11 rounded-full"
                          disabled={!reflectText.trim()}
                          onClick={() => void submitReflection(rec.id, "used")}
                        >
                          Save privately
                        </Button>
                      </R360Card>
                    )}
                  </div>
                ))
              )}
            </section>

            {(status.reflections ?? []).length > 0 && (
              <section className="mt-8 min-w-0">
                <h3 className="text-[18px] font-medium">Your own notes</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Self-reported by you. These are kept apart from observed evidence and never treated as proof that anything changed.
                </p>
                <ul className="mt-3 space-y-2">
                  {status.reflections.map((reflection) => (
                    <li key={reflection.id} className="rounded-xl border border-btln-line p-3">
                      <p className="text-[14px] leading-relaxed">{reflection.response_text}</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {new Date(reflection.self_reported_at).toLocaleDateString()}
                        {reflection.outcome ? ` · ${reflection.outcome.replace("_", " ")}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </FeedbackProvider>
      )}
    </section>
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
