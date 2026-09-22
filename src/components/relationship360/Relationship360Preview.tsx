import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  R360Card,
  R360Overview,
  R360PatternDetail,
  R360PeriodTimeline,
  R360RecommendationCard,
  R360SourceManager,
  R360ThenNow,
  R360WhatsWorking,
} from "@/components/relationship360/display";
import { RelationshipMap } from "@/components/relationship360/RelationshipMap";
import { computeR360View, distinctByMeaning, QUESTION_LABELS, resolveEvidence } from "@/lib/relationship360/select";
import { relationship360Preview as data } from "@/lib/relationship360/preview";
import { track } from "@/lib/analytics";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";

export const R360_HEADLINE =
  "Understand who you are in your relationships—and get insights and coaching for self improvement.";

type DemoState = "sparse" | "initial" | "updated";

/** Which fictional conversations exist in each demo state. */
const DEMO_SOURCES: Record<DemoState, string[]> = {
  sparse: ["s2"],
  initial: ["s1", "s2", "s3", "s4"],
  updated: ["s1", "s2", "s3", "s4", "s5", "s6"],
};

const DEMO_LABEL: Record<DemoState, string> = {
  sparse: "One conversation",
  initial: "First review",
  updated: "After new conversations",
};

/**
 * Fully interactive, entirely fictional Relationship360. Local state only:
 * nothing is saved to an account and no analysis service is called.
 */
export const Relationship360Preview = () => {
  const [demoState, setDemoState] = useState<DemoState>("initial");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<string | null>(null);
  const [checkIns, setCheckIns] = useState<Record<string, "yes" | "no">>({});
  const [showMoreInsights, setShowMoreInsights] = useState(false);
  // What the fictional person had already seen when they last reviewed the profile.
  const [reviewed, setReviewed] = useState<string[]>(DEMO_SOURCES.initial);
  const visits = useRef(0);

  const available = DEMO_SOURCES[demoState];
  const sources = useMemo(() => data.sources.filter((s) => available.includes(s.id)), [available]);

  // Conversations that are not part of this demo state behave exactly like excluded ones,
  // so anything they supported is withheld rather than quietly kept.
  const effectiveExcluded = useMemo(() => {
    const next = new Set(excluded);
    data.sources.forEach((s) => {
      if (!available.includes(s.id)) next.add(s.id);
    });
    return next;
  }, [excluded, available]);

  const view = useMemo(() => computeR360View(data, effectiveExcluded), [effectiveExcluded]);

  useEffect(() => {
    visits.current += 1;
    track("profile_viewed", { visitor: visits.current === 1 ? "first" : "returning", demo: true });
  }, [demoState]);

  const inScope = (sourceId: string) => {
    const source = data.sources.find((s) => s.id === sourceId);
    if (!source) return false;
    if (period && source.periodId !== period) return false;
    if (relationship && source.relationshipId !== relationship) return false;
    return true;
  };

  const patterns = distinctByMeaning(view.patterns.filter((p) => p.evidence.some((e) => inScope(e.sourceId))));
  const patternKeys = new Set(patterns.flatMap((pattern) => pattern.semanticKey ? [pattern.semanticKey] : []));
  const working = distinctByMeaning(view.working.filter((item) =>
    item.evidence.some((e) => inScope(e.sourceId)) && !patternKeys.has(item.semanticKey),
  ));
  const recommendations = distinctByMeaning(view.recommendations.filter((r) => r.evidence.some((e) => inScope(e.sourceId)))).slice(0, 3);
  const visiblePatterns = showMoreInsights ? patterns : patterns.slice(0, 3);

  const relationshipLabel = (id: string) => data.relationships.find((r) => r.id === id)?.label ?? id;
  const includedCount = (relationshipId: string) =>
    view.includedSources.filter((s) => s.relationshipId === relationshipId).length;

  const newSources = view.includedSources.filter((s) => !reviewed.includes(s.id));

  const change = patterns.find((p) => p.state === "different");
  const recurring = patterns.find((p) => p.state === "again");

  const comparison = (data.comparisons ?? []).find(
    (c) =>
      view.includedSources.some((s) => s.periodId === c.earlierPeriodId) &&
      view.includedSources.some((s) => s.periodId === c.laterPeriodId),
  );

  const dirty =
    excluded.size > 0 ||
    period !== null ||
    relationship !== null ||
    Object.keys(checkIns).length > 0 ||
    demoState !== "initial";

  return (
    <FeedbackProvider sourceKind="relationship360" sourceId="example-preview" demo>
    <div className="min-w-0">
      <R360Overview
        headline={R360_HEADLINE}
        takeaways={patterns.slice(0, 3).map((pattern) => ({ id: pattern.id, label: pattern.title }))}
        counts={{
          sources: view.includedSources.length,
          relationships: new Set(view.includedSources.map((s) => s.relationshipId)).size,
          periods: new Set(view.includedSources.map((s) => s.periodId)).size,
        }}
      />

      <R360Card className="mt-4">
        <p className="text-[13px] font-medium">Demo state</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Switch what this fictional person has included, to see how the profile answers with a lot, a little, and
          nothing to compare.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Demo state">
          {(Object.keys(DEMO_SOURCES) as DemoState[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={demoState === key}
              onClick={() => setDemoState(key)}
              className={`min-h-11 rounded-full border px-4 text-[14px] transition-colors motion-reduce:transition-none ${demoState === key ? "border-foreground bg-foreground text-background" : "border-btln-line text-muted-foreground"}`}
            >
              {DEMO_LABEL[key]}
            </button>
          ))}
        </div>
      </R360Card>

      <R360Card className="mt-4">
        <p className="text-[14px] font-medium">Since your last review</p>
        {newSources.length === 0 ? (
          <p className="mt-1 text-[14px] text-muted-foreground">
            No new conversations since your last review. Nothing has changed just because time passed — add a
            conversation, or check in on a step you took.
          </p>
        ) : (
          <>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {newSources.length} new conversation{newSources.length === 1 ? "" : "s"} have been included:{" "}
              {newSources.map((s) => s.label).join(", ")}.
            </p>
            <button
              type="button"
              onClick={() => setReviewed(view.includedSources.map((s) => s.id))}
              className="mt-1 inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Mark as reviewed
            </button>
          </>
        )}
      </R360Card>

      <div className="mt-8">
        <RelationshipMap
          relationships={data.relationships}
          active={relationship}
          onSelect={(id) => {
            setRelationship(id);
            const scope = id ? data.relationships.find((r) => r.id === id)?.scope ?? "pair" : "all";
            track("relationship_filter_used", { scope, demo: true });
          }}
          countFor={includedCount}
        />
      </div>

      {comparison ? (
        <details className="mt-8">
          <summary className="flex min-h-11 cursor-pointer items-center text-[18px] font-medium underline decoration-btln-sage underline-offset-4">
            Compare Then / Now
          </summary>
        <R360ThenNow
          comparison={comparison}
          periods={data.periods}
          metrics={data.metrics ?? []}
          thenEvidence={resolveEvidence(data, comparison.then.evidence)}
          nowEvidence={resolveEvidence(data, comparison.now.evidence)}
          onOpen={() => track("comparison_opened", { demo: true })}
        />
        </details>
      ) : (
        <section className="mt-8 min-w-0">
          <h2 className="text-[18px] font-medium">Then / Now</h2>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Not enough to compare yet. Two periods with similar coverage are needed before a then-and-now is
            honest.
          </p>
        </section>
      )}

      <div className="mt-8 min-w-0">
        <h2 className="text-[18px] font-medium">Periods</h2>
        <div className="mt-3">
          <R360PeriodTimeline
            periods={data.periods.map((p) => ({
              ...p,
              count: view.includedSources.filter((s) => s.periodId === p.id).length,
            }))}
            active={period}
            onSelect={setPeriod}
          />
        </div>
      </div>

      <section className="mt-8 min-w-0">
        <h2 className="text-[18px] font-medium">Your patterns</h2>
        {patterns.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted-foreground">
            Not enough included evidence in this selection to describe a pattern.
          </p>
        ) : (
          visiblePatterns.map((pattern) => (
            <R360PatternDetail
              key={pattern.id}
              pattern={pattern}
              questionLabel={QUESTION_LABELS[pattern.question]}
              evidence={resolveEvidence(data, pattern.evidence)}
              onEvidenceOpen={() => track("evidence_opened", { surface: "pattern", demo: true })}
            />
          ))
        )}
        {patterns.length > 3 && (
          <button
            type="button"
            aria-expanded={showMoreInsights}
            onClick={() => setShowMoreInsights((value) => !value)}
            className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4"
          >
            {showMoreInsights ? "Fewer insights" : `More insights (${patterns.length - 3})`}
          </button>
        )}
        {view.withheld.length > 0 && (
          <R360Card className="mt-3 bg-btln-mint/40">
            <p className="text-[14px] font-medium">Withheld after your changes</p>
            <ul className="mt-2 space-y-1 text-[14px] text-muted-foreground">
              {view.withheld.map((item) => (
                <li key={item.title}>
                  {item.title} — {item.reason}
                </li>
              ))}
            </ul>
          </R360Card>
        )}
      </section>

      <R360WhatsWorking items={working} evidenceFor={(item) => resolveEvidence(data, item.evidence)} />

      <section className="mt-8 min-w-0">
        <h2 className="text-[18px] font-medium">Suggested next steps</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">{QUESTION_LABELS.next}</p>
        {recommendations.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted-foreground">
            No action is supported by the included evidence. Nothing is invented to fill the space.
          </p>
        ) : (
          recommendations.map((rec) => (
            <R360RecommendationCard
              key={rec.id}
              recommendation={rec}
              evidence={resolveEvidence(data, rec.evidence)}
              checkIn={checkIns[rec.id] ?? null}
              onCheckIn={(value) => {
                setCheckIns((prev) => ({ ...prev, [rec.id]: value }));
                track("checkin_completed", { used: value === "yes", demo: true });
              }}
            />
          ))
        )}
      </section>

      <section className="mt-8 min-w-0">
        {newSources.length >= 2 ? (
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center text-[18px] font-medium underline decoration-btln-sage underline-offset-4">
              Monthly review
            </summary>
          <ol className="mt-3 space-y-3">
            {[
              recurring && { label: "What repeated", href: `#pattern-${recurring.id}` },
              change && { label: "What changed", href: `#pattern-${change.id}` },
              recommendations[0] && { label: "Suggested next step", href: `#recommendation-${recommendations[0].id}` },
            ]
              .filter(Boolean)
              .map((step) => (
                <li key={(step as { label: string }).label}>
                  <a
                    href={(step as { href: string }).href}
                    className="inline-flex min-h-11 items-center text-[15px] underline decoration-btln-sage underline-offset-4"
                  >
                    {(step as { label: string }).label}
                  </a>
                </li>
              ))}
          </ol>
          </details>
        ) : (
          <p className="text-[14px] text-muted-foreground">Monthly review appears when enough new evidence supports one.</p>
        )}
      </section>

      <R360SourceManager
        sources={sources}
        stateFor={(source) => (excluded.has(source.id) ? "excluded" : "included")}
        relationshipLabel={relationshipLabel}
        onToggle={(source) =>
          setExcluded((prev) => {
            const next = new Set(prev);
            if (next.has(source.id)) next.delete(source.id);
            else next.add(source.id);
            return next;
          })
        }
      />

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-12 rounded-full"
          disabled={!dirty}
          onClick={() => {
            setDemoState("initial");
            setExcluded(new Set());
            setPeriod(null);
            setRelationship(null);
            setCheckIns({});
            setShowMoreInsights(false);
            setReviewed(DEMO_SOURCES.initial);
          }}
        >
          Reset this demo
        </Button>
        <Button asChild className="min-h-12 rounded-full">
          <Link to="/prime?return_to=/examples/relationship360">See Prime</Link>
        </Button>
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">
        Everything here is fictional and changes only this page. Relationship360 is in development, so nothing is
        saved to an account and no analysis runs from this preview.
      </p>
    </div>
    </FeedbackProvider>
  );
};
