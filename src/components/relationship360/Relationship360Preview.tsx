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
  R360WhatsNew,
  R360WhatsWorking,
} from "@/components/relationship360/display";
import { RelationshipMap } from "@/components/relationship360/RelationshipMap";
import { computeR360View, QUESTION_LABELS, resolveEvidence } from "@/lib/relationship360/select";
import { relationship360Preview as data } from "@/lib/relationship360/preview";
import { track } from "@/lib/analytics";

export const R360_HEADLINE =
  "Understand who you are in your relationships—and get insights and coaching for self improvement.";
export const R360_SUPPORTING =
  "See the patterns in how you communicate, respond, and connect—with practical coaching that develops as you add more conversations.";

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

  const patterns = view.patterns.filter((p) => p.evidence.some((e) => inScope(e.sourceId)));
  const working = view.working.filter((w) => w.evidence.some((e) => inScope(e.sourceId)));
  const recommendations = view.recommendations.filter((r) => r.evidence.some((e) => inScope(e.sourceId)));

  const relationshipLabel = (id: string) => data.relationships.find((r) => r.id === id)?.label ?? id;
  const includedCount = (relationshipId: string) =>
    view.includedSources.filter((s) => s.relationshipId === relationshipId).length;

  const newSources = view.includedSources.filter((s) => !reviewed.includes(s.id));

  // "What's new": a supported change, a recurrence, and something working. Slots stay empty
  // when the included evidence does not support them.
  const change = patterns.find((p) => p.state === "different");
  const recurring = patterns.find((p) => p.state === "again");
  const whatsNew = [
    change && {
      id: change.id,
      kind: "What changed",
      conclusion: change.statement,
      observed: change.observedRange ?? "the included conversations",
      evidence: resolveEvidence(data, change.evidence),
    },
    recurring && {
      id: recurring.id,
      kind: "What keeps happening",
      conclusion: recurring.statement,
      observed: recurring.observedRange ?? "the included conversations",
      evidence: resolveEvidence(data, recurring.evidence),
    },
    working[0] && {
      id: working[0].id,
      kind: "What's working",
      conclusion: working[0].statement,
      observed: "the included conversations",
      evidence: resolveEvidence(data, working[0].evidence),
    },
  ].filter(Boolean) as { id: string; kind: string; conclusion: string; observed: string; evidence: ReturnType<typeof resolveEvidence> }[];

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
    <div className="min-w-0">
      <R360Overview
        headline={R360_HEADLINE}
        supporting={R360_SUPPORTING}
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

      <R360WhatsNew items={whatsNew} />

      {comparison ? (
        <R360ThenNow
          comparison={comparison}
          periods={data.periods}
          metrics={data.metrics ?? []}
          thenEvidence={resolveEvidence(data, comparison.then.evidence)}
          nowEvidence={resolveEvidence(data, comparison.now.evidence)}
          onOpen={() => track("comparison_opened", { demo: true })}
        />
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
          patterns.map((pattern) => (
            <R360PatternDetail
              key={pattern.id}
              pattern={pattern}
              questionLabel={QUESTION_LABELS[pattern.question]}
              evidence={resolveEvidence(data, pattern.evidence)}
              onEvidenceOpen={() => track("evidence_opened", { surface: "pattern", demo: true })}
            />
          ))
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
        <h2 className="text-[18px] font-medium">Monthly review</h2>
        {newSources.length >= 2 ? (
          <ol className="mt-3 space-y-3">
            {[
              recurring && { label: "What repeated", text: recurring.statement },
              change && { label: "What changed", text: change.statement },
              working[0] && { label: "What to continue", text: working[0].statement },
              recommendations[0] && { label: "Suggested next step", text: recommendations[0].action },
            ]
              .filter(Boolean)
              .map((step) => (
                <li key={(step as { label: string }).label}>
                  <R360Card>
                    <p className="text-[13px] font-medium text-btln-forest">{(step as { label: string }).label}</p>
                    <p className="mt-1 text-[15px] leading-relaxed">{(step as { text: string }).text}</p>
                  </R360Card>
                </li>
              ))}
          </ol>
        ) : (
          <p className="mt-2 text-[14px] text-muted-foreground">
            A review is written only when there is enough new evidence to say something different. There isn't yet.
          </p>
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
  );
};
