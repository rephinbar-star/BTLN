import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  R360Card,
  R360Overview,
  R360PatternDetail,
  R360PeriodTimeline,
  R360RecommendationCard,
  R360RelationshipCards,
  R360SourceManager,
  R360WhatsWorking,
} from "@/components/relationship360/display";
import { computeR360View, QUESTION_LABELS, resolveEvidence } from "@/lib/relationship360/select";
import { relationship360Preview as data } from "@/lib/relationship360/preview";

export const R360_HEADLINE =
  "Understand who you are in your relationships—and get insights and coaching for self improvement.";
export const R360_SUPPORTING =
  "See the patterns in how you communicate, respond, and connect—with practical coaching that develops as you add more conversations.";

/**
 * Fully interactive, entirely fictional Relationship360. Local state only:
 * nothing is saved to an account and no analysis service is called.
 */
export const Relationship360Preview = () => {
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<string | null>(null);
  const [checkIns, setCheckIns] = useState<Record<string, "yes" | "no">>({});

  const view = useMemo(() => computeR360View(data, excluded), [excluded]);

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

  const dirty = excluded.size > 0 || period !== null || relationship !== null || Object.keys(checkIns).length > 0;

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

      <div className="mt-6 min-w-0">
        <h3 className="text-[18px] font-medium">Periods</h3>
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

      <div className="mt-6 min-w-0">
        <h3 className="text-[18px] font-medium">Relationships</h3>
        <R360RelationshipCards
          relationships={data.relationships}
          active={relationship}
          onSelect={setRelationship}
          countFor={includedCount}
        />
      </div>

      <section className="mt-8 min-w-0">
        <h3 className="text-[18px] font-medium">Your patterns</h3>
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
        <h3 className="text-[18px] font-medium">Suggested next steps</h3>
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
              onCheckIn={(value) => setCheckIns((prev) => ({ ...prev, [rec.id]: value }))}
            />
          ))
        )}
      </section>

      <R360SourceManager
        sources={data.sources}
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
            setExcluded(new Set());
            setPeriod(null);
            setRelationship(null);
            setCheckIns({});
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
