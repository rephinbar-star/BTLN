import { useId, useState } from "react";
import { Check } from "lucide-react";
import { SourceConversation } from "@/components/examples/SourceConversation";
import type {
  R360Pattern,
  R360Recommendation,
  R360Relationship,
  R360Source,
  R360Working,
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
  supporting,
  counts,
}: {
  headline: string;
  supporting: string;
  counts: { sources: number; relationships: number; periods: number };
}) => (
  <section className="min-w-0">
    <h2 className="text-[22px] font-medium leading-tight tracking-[-0.5px] sm:text-[26px]">{headline}</h2>
    <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{supporting}</p>
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

/** Pattern with disclosable evidence. Observation, interpretation and limits stay separate. */
export const R360PatternDetail = ({
  pattern,
  evidence,
  questionLabel,
}: {
  pattern: R360Pattern;
  evidence: ResolvedEvidence[];
  questionLabel: string;
}) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <R360Card className="mt-3">
      <p className="text-[13px] font-medium text-btln-forest">{questionLabel}</p>
      <h3 className="mt-1 text-[17px] font-medium">{pattern.title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed">{pattern.statement}</p>
      {pattern.interpretation && (
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">Interpretation:</strong> {pattern.interpretation}
        </p>
      )}
      {pattern.counterexample && (
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">Counterexample:</strong> {pattern.counterexample}
        </p>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4"
      >
        {open ? "Hide evidence" : `Evidence (${evidence.length})`}
      </button>
      <div id={id} hidden={!open}>
        <EvidenceList items={evidence} />
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">
        {pattern.confidence} confidence · {pattern.limitation}
      </p>
    </R360Card>
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
          <EvidenceList items={evidenceFor(item)} />
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
    <p className="text-[13px] font-medium text-btln-forest">
      {recommendation.type === "communication" ? "Communication" : "Behaviour"}
    </p>
    <h4 className="mt-1 text-[16px] font-medium">Suggestions for next time</h4>
    <dl className="mt-2 space-y-2 text-[15px] leading-relaxed">
      <div>
        <dt className="text-[13px] text-muted-foreground">Observation</dt>
        <dd>{recommendation.observation}</dd>
      </div>
      <div>
        <dt className="text-[13px] text-muted-foreground">Suggested response</dt>
        <dd>{recommendation.action}</dd>
      </div>
      <div>
        <dt className="text-[13px] text-muted-foreground">Why it may help</dt>
        <dd>{recommendation.why}</dd>
      </div>
    </dl>
    <EvidenceList items={evidence} />
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
