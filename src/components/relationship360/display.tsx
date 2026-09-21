import { useId, useState } from "react";
import { Check } from "lucide-react";
import { SourceConversation } from "@/components/examples/SourceConversation";
import {
  PATTERN_STATE_LABEL,
  type R360Comparison,
  type R360Metric,
  type R360Pattern,
  type R360PatternState,
  type R360Recommendation,
  type R360Relationship,
  type R360Source,
  type R360Working,
} from "@/lib/relationship360/types";

import type { ResolvedEvidence } from "@/lib/relationship360/select";

const CONTEXT_LABEL: Record<R360Relationship["context"], string> = {
  romantic: "Romantic",
  friend: "Friend",
  family: "Family",
  work: "Work",
};

export const R360Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-[20px] border border-btln-line bg-card p-[18px] ${className}`}>{children}</div>
);

export const R360Overview = ({
  headline,
  takeaways,
  counts,
}: {
  headline: string;
  takeaways: { id: string; label: string }[];
  counts: { sources: number; relationships: number; periods: number };
}) => (
  <section className="min-w-0" data-r360-narrative>
    <h2 className="text-[22px] font-medium leading-tight tracking-[-0.5px] sm:text-[26px]">{headline}</h2>
    {takeaways.length > 0 && (
      <ul className="mt-3 space-y-1 text-[15px] leading-relaxed text-muted-foreground">
        {takeaways.slice(0, 3).map((item) => (
          <li key={item.id}>
            <a className="underline decoration-btln-sage underline-offset-4" href={`#pattern-${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ul>
    )}
    <p className="mt-3 text-[14px] text-muted-foreground">
      Built from {counts.sources} included {counts.sources === 1 ? "conversation" : "conversations"} across{" "}
      {counts.relationships} {counts.relationships === 1 ? "relationship" : "relationships"} and {counts.periods}{" "}
      {counts.periods === 1 ? "period" : "periods"}.
    </p>
  </section>
);

/** Horizontal, scrollable period switch. */
export const R360PeriodTimeline = ({
  periods,
  active,
  onSelect,
}: {
  periods: { id: string; label: string; count: number }[];
  active: string | null;
  onSelect: (id: string | null) => void;
}) => (
  <div className="-mx-1 flex min-w-0 flex-wrap gap-2" role="group" aria-label="Periods">
    <button
      type="button"
      aria-pressed={active === null}
      onClick={() => onSelect(null)}
      className={`min-h-11 rounded-full border px-4 text-[14px] ${active === null ? "border-foreground bg-foreground text-background" : "border-btln-line text-muted-foreground"}`}
    >
      All periods
    </button>
    {periods.map((p) => (
      <button
        key={p.id}
        type="button"
        aria-pressed={active === p.id}
        onClick={() => onSelect(p.id)}
        className={`min-h-11 rounded-full border px-4 text-[14px] ${active === p.id ? "border-foreground bg-foreground text-background" : "border-btln-line text-muted-foreground"}`}
      >
        {p.label} · {p.count}
      </button>
    ))}
  </div>
);

export const R360RelationshipCards = ({
  relationships,
  active,
  onSelect,
  countFor,
}: {
  relationships: R360Relationship[];
  active: string | null;
  onSelect: (id: string | null) => void;
  countFor: (id: string) => number;
}) => (
  <div className="mt-3 grid gap-3 sm:grid-cols-2" role="group" aria-label="Relationships">
    <button
      type="button"
      aria-pressed={active === null}
      onClick={() => onSelect(null)}
      className={`min-h-11 rounded-[20px] border p-4 text-left ${active === null ? "border-foreground" : "border-btln-line"}`}
    >
      <span className="text-[15px] font-medium">Everyone</span>
      <span className="mt-1 block text-[13px] text-muted-foreground">All included relationships</span>
    </button>
    {relationships.map((rel) => (
      <button
        key={rel.id}
        type="button"
        aria-pressed={active === rel.id}
        onClick={() => onSelect(rel.id)}
        className={`min-h-11 rounded-[20px] border p-4 text-left ${active === rel.id ? "border-foreground" : "border-btln-line"}`}
      >
        <span className="text-[15px] font-medium">{rel.label}</span>
        <span className="mt-1 block text-[13px] text-muted-foreground">
          {rel.scope === "group" ? "Group" : "One to one"} · {CONTEXT_LABEL[rel.context]} · {countFor(rel.id)} included
        </span>
      </button>
    ))}
  </div>
);

const EvidenceList = ({ items }: { items: ResolvedEvidence[] }) => (
  <ul className="mt-3 space-y-3">
    {items.map((item, index) => (
      <li key={`${item.sourceId}-${index}`} className="min-w-0 border-l-2 border-btln-sage pl-4">
        <p className="min-w-0 whitespace-pre-wrap break-words text-[15px] leading-6">
          {item.sender}: “{item.text}”
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {item.product} · {item.sourceLabel} · {item.observedRange}
        </p>
      </li>
    ))}
  </ul>
);

/** Pattern with disclosable evidence. Observation, introspection and limits stay separate. */
/** Plain-language state. Text carries the meaning; colour never carries it alone. */
export const R360StateChip = ({ state }: { state: R360PatternState }) => (
  <span
    className={`inline-flex min-h-7 items-center rounded-full border px-3 text-[12px] font-medium ${
      state === "different" ? "border-btln-forest bg-btln-mint" : "border-btln-line bg-card"
    }`}
  >
    {PATTERN_STATE_LABEL[state]}
  </span>
);

export const R360PatternDetail = ({
  pattern,
  evidence,
  questionLabel,
  onEvidenceOpen,
}: {
  pattern: R360Pattern;
  evidence: ResolvedEvidence[];
  questionLabel: string;
  onEvidenceOpen?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [deeperOpen, setDeeperOpen] = useState(false);
  const id = useId();
  const introspectionId = useId();
  const introspection = pattern.introspection;
  const visiblePaths = introspection?.paths.slice(0, 1) ?? [];
  const deeperPaths = introspection?.paths.slice(1) ?? [];
  return (
    <R360Card className="mt-3" >
      <article id={`pattern-${pattern.id}`} className="scroll-mt-20" data-r360-narrative>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-medium text-btln-forest">{questionLabel}</p>
        {pattern.state && <R360StateChip state={pattern.state} />}
      </div>
      <h3 className="mt-2 text-[17px] font-medium">{pattern.title}</h3>
      {pattern.observedRange && (
        <p className="mt-1 text-[13px] text-muted-foreground">Observed {pattern.observedRange}</p>
      )}
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{pattern.whyItMatters ?? pattern.statement}</p>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
        className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4"
      >
        {open ? "Close insight" : "Open insight"}
      </button>
      <div id={id} hidden={!open}>
      <p className="mt-2 text-[15px] leading-relaxed"><strong className="font-medium">What we observed:</strong> {pattern.statement}</p>
      <section className="mt-4 border-t border-btln-line pt-4" aria-labelledby={`${introspectionId}-heading`}>
        <h4 id={`${introspectionId}-heading`} className="text-[15px] font-medium">Introspection</h4>
        {introspection ? (
          <>
            <p className="mt-2 text-[15px] leading-relaxed">{introspection.openingQuestion}</p>
            {introspection.paths.length > 0 && (
              <button
                type="button"
                aria-expanded={deeperOpen}
                aria-controls={`${introspectionId}-deeper`}
                onClick={() => setDeeperOpen((value) => !value)}
                className="inline-flex min-h-11 items-center text-[14px] underline underline-offset-4"
              >
                {deeperOpen ? "Show less" : "Explore this further"}
              </button>
            )}
            <div id={`${introspectionId}-deeper`} hidden={!deeperOpen || introspection.paths.length === 0}>
              {[...visiblePaths, ...deeperPaths].slice(0, 2).map((path) => (
                <div key={path.label} className="mt-3 rounded-lg bg-btln-mint/40 p-3">
                  <p className="text-[14px] font-medium">{path.label}</p>
                  {path.questions.map((question) => (
                    <p key={question} className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{question}</p>
                  ))}
                </div>
              ))}
            </div>
            {deeperOpen && <p className="mt-3 text-[14px] leading-relaxed">{introspection.closingQuestion}</p>}
            {introspection.selfReportedReflection && (
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                <strong className="font-medium text-foreground">Self-reported reflection:</strong>{" "}
                “{introspection.selfReportedReflection}”
              </p>
            )}
            {introspection.suggestedNextStepId && (
              <a className="mt-2 inline-flex min-h-11 items-center text-[14px] underline underline-offset-4" href={`#recommendation-${introspection.suggestedNextStepId}`}>
                See the related next step
              </a>
            )}
          </>
        ) : (
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            What was happening for you here? Which parts felt deliberate, useful or surprising, and what might you want to understand before deciding what to do next?
          </p>
        )}
      </section>
      {pattern.counterexample && (
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">Counterexample:</strong> {pattern.counterexample}
        </p>
      )}
      {pattern.exception && (
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">The exception:</strong> {pattern.exception}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          setEvidenceOpen((value) => !value);
          if (!evidenceOpen) onEvidenceOpen?.();
        }}
        aria-expanded={evidenceOpen}
        aria-controls={`${id}-evidence`}
        className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4"
      >
        {evidenceOpen ? "Hide evidence" : `Why we're showing this (${evidence.length})`}
      </button>
      <div id={`${id}-evidence`} hidden={!evidenceOpen}>
        <EvidenceList items={evidence} />
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">
        {pattern.confidence} confidence · {pattern.limitation}
      </p>
      </div>
      </article>
    </R360Card>
  );
};

/** Then / Now. Two observations, real coverage on each side, counted metrics only. */
export const R360ThenNow = ({
  comparison,
  periods,
  metrics,
  thenEvidence,
  nowEvidence,
  onOpen,
}: {
  comparison: R360Comparison;
  periods: { id: string; label: string; range?: string }[];
  metrics: R360Metric[];
  thenEvidence: ResolvedEvidence[];
  nowEvidence: ResolvedEvidence[];
  onOpen?: () => void;
}) => {
  const [side, setSide] = useState<"then" | "now">("then");
  const id = useId();
  const label = (periodId: string) => periods.find((p) => p.id === periodId)?.label ?? periodId;
  const active = side === "then" ? comparison.then : comparison.now;
  const evidence = side === "then" ? thenEvidence : nowEvidence;
  return (
    <section className="mt-8 min-w-0" aria-labelledby="r360-thennow">
      <h2 id="r360-thennow" className="text-[18px] font-medium">
        Then / Now
      </h2>
      <div className="mt-3 flex gap-2" role="group" aria-label="Compare periods">
        {(["then", "now"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={side === key}
            onClick={() => {
              setSide(key);
              onOpen?.();
            }}
            className={`min-h-11 flex-1 rounded-full border px-4 text-[14px] transition-colors motion-reduce:transition-none ${side === key ? "border-foreground bg-foreground text-background" : "border-btln-line text-muted-foreground"}`}
          >
            {key === "then" ? "Then" : "Now"} · {label(key === "then" ? comparison.earlierPeriodId : comparison.laterPeriodId)}
          </button>
        ))}
      </div>
      <R360Card className="mt-3">
        <p className="text-[15px] leading-relaxed">{active.observation}</p>
        <p className="mt-2 text-[13px] text-muted-foreground">{active.coverage}</p>
        <div id={id}>
          <EvidenceList items={evidence} />
        </div>
      </R360Card>
      {metrics.map((metric) => {
        const then = metric.then;
        const now = metric.now;
        return (
          <R360Card key={metric.id} className="mt-3">
            <p className="text-[14px] font-medium">{metric.label}</p>
            <ul className="mt-2 space-y-2">
              {[
                { key: "then", label: label(then.periodId), value: then.value, of: then.of },
                { key: "now", label: label(now.periodId), value: now.value, of: now.of },
              ].map((row) => (
                <li key={row.key} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span>{row.label}</span>
                    <span className="text-muted-foreground">
                      {row.value} of {row.of} {metric.unit}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-btln-line" aria-hidden>
                    <div
                      className="h-2 rounded-full bg-btln-forest"
                      style={{ width: `${row.of === 0 ? 0 : (row.value / row.of) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {metric.missingData && <p className="mt-2 text-[12px] text-muted-foreground">{metric.missingData}</p>}
          </R360Card>
        );
      })}
      <p className="mt-3 text-[13px] text-muted-foreground">{comparison.note}</p>
    </section>
  );
};


export const R360WhatsWorking = ({ items, evidenceFor }: { items: R360Working[]; evidenceFor: (item: R360Working) => ResolvedEvidence[] }) => (
  <section className="mt-6 min-w-0">
    <h3 className="text-[18px] font-medium">What's working</h3>
    {items.length === 0 ? (
      <p className="mt-2 text-[14px] text-muted-foreground">Nothing is supported by the included conversations.</p>
    ) : (
      items.map((item) => (
        <R360Card key={item.id} className="mt-3">
          <p className="flex gap-2 text-[15px] leading-relaxed">
            <Check className="mt-1 h-4 w-4 shrink-0 text-btln-forest" aria-hidden />
            {item.statement}
          </p>
          <details className="mt-1">
            <summary className="flex min-h-11 cursor-pointer items-center text-[14px] underline underline-offset-4">
              Why we're showing this ({evidenceFor(item).length})
            </summary>
            <EvidenceList items={evidenceFor(item)} />
          </details>
        </R360Card>
      ))
    )}
  </section>
);

/** Recommendation plus its optional, clearly-labelled self-reported check-in. */
export const R360RecommendationCard = ({
  recommendation,
  evidence,
  checkIn,
  onCheckIn,
}: {
  recommendation: R360Recommendation;
  evidence: ResolvedEvidence[];
  checkIn?: "yes" | "no" | null;
  onCheckIn?: (value: "yes" | "no") => void;
}) => (
  <R360Card className="mt-3">
    <article id={`recommendation-${recommendation.id}`} className="scroll-mt-20" data-r360-narrative>
    <p className="text-[13px] font-medium text-btln-forest">
      {recommendation.type === "communication" ? "Communication" : "Behaviour"}
    </p>
    <h4 className="mt-1 text-[16px] font-medium">{recommendation.action}</h4>
    <dl className="mt-2 space-y-2 text-[14px] leading-relaxed">
      <div>
        <dt className="text-[13px] text-muted-foreground">Why it may help</dt>
        <dd>{recommendation.why}</dd>
      </div>
    </dl>
    <details className="mt-1">
      <summary className="flex min-h-11 cursor-pointer items-center text-[14px] underline underline-offset-4">Why we're suggesting this ({evidence.length})</summary>
      <EvidenceList items={evidence} />
    </details>
    {onCheckIn && (
      <div className="mt-4 border-t border-btln-line pt-3">
        <p className="text-[14px] font-medium">Did you use this suggestion?</p>
        <div className="mt-2 flex gap-2">
          {(["yes", "no"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={checkIn === value}
              onClick={() => onCheckIn(value)}
              className={`min-h-11 rounded-full border px-5 text-[14px] ${checkIn === value ? "border-foreground bg-foreground text-background" : "border-btln-line text-muted-foreground"}`}
            >
              {value === "yes" ? "Yes" : "Not yet"}
            </button>
          ))}
        </div>
        {checkIn && (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Self-reported by you. It is stored separately from observed behaviour.
          </p>
        )}
      </div>
    )}
    {recommendation.selfReport && (
      <p className="mt-3 text-[13px] text-muted-foreground">{recommendation.selfReport.note}</p>
    )}
    </article>
  </R360Card>
);

export type R360SourceState = "included" | "excluded";

export const R360SourceManager = ({
  sources,
  stateFor,
  onToggle,
  relationshipLabel,
}: {
  sources: R360Source[];
  stateFor: (source: R360Source) => R360SourceState;
  onToggle: (source: R360Source) => void;
  relationshipLabel: (id: string) => string;
}) => (
  <section className="mt-8 min-w-0">
    <h3 className="text-[18px] font-medium">Conversations included</h3>
    <ul className="mt-3 space-y-3">
      {sources.map((source) => {
        const state = stateFor(source);
        return (
          <li key={source.id} className="min-w-0 rounded-[20px] border border-btln-line p-4">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-[15px] font-medium">{source.label}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {source.product} · {relationshipLabel(source.relationshipId)} · {source.observedRange}
                </p>
                <p className="mt-1 text-[13px] font-medium">{state === "included" ? "Included" : "Excluded"}</p>
              </div>
              <button
                type="button"
                onClick={() => onToggle(source)}
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                {state === "included" ? "Exclude this conversation" : "Include again"}
              </button>
            </div>
            <div className="mt-2">
              <SourceConversation messages={source.messages} title="The conversation" />
            </div>
          </li>
        );
      })}
    </ul>
  </section>
);
