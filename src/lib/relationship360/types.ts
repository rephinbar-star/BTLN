import type { ExampleMessage } from "@/lib/examples/sourceFixtures";

export type R360Period = { id: string; label: string; range?: string };

export type R360RelationshipScope = "pair" | "group";
export type R360RelationshipContext = "romantic" | "friend" | "family" | "work";

export type R360Relationship = {
  id: string;
  label: string;
  scope: R360RelationshipScope;
  context: R360RelationshipContext;
};

export type R360Product = "Quick Take" | "Deep Read" | "Group Read" | "Group Roast";

export type R360Source = {
  id: string;
  relationshipId: string;
  periodId: string;
  product: R360Product;
  label: string;
  /** Observed period of the conversation itself, never the upload date. */
  observedRange: string;
  messages: ExampleMessage[];
};

export type R360EvidenceRef = { sourceId: string; messageId: string };

export type R360Question = "noticing" | "repeating" | "changed" | "across" | "next";

export type R360Confidence = "low" | "medium" | "high";

/**
 * Plain-language state of a pattern. "different" means the behaviour changed,
 * "insufficient" means there is not enough comparable evidence — never a score.
 */
export type R360PatternState = "again" | "different" | "insufficient";

export const PATTERN_STATE_LABEL: Record<R360PatternState, string> = {
  again: "Noticed again",
  different: "Different this time",
  insufficient: "Not enough to compare",
};

export type R360IntrospectionPath = {
  /** A short possibility to explore, never a conclusion about motive. */
  label: string;
  /** Contextual questions connecting feeling, interpretation, need and action. */
  questions: string[];
  /** Evidence that makes this path relevant enough to ask. */
  evidenceRefs: R360EvidenceRef[];
};

export type R360Introspection = {
  openingQuestion: string;
  paths: R360IntrospectionPath[];
  closingQuestion: string;
  /** Optional bridge to an applicable recommendation. */
  focusedReflection?: string;
  suggestedNextStepId?: string;
  /** Optional fictional/user-provided context; never treated as observed behaviour. */
  selfReportedReflection?: string;
};

export type R360Pattern = {
  id: string;
  /** Meaning-level identity used to prevent paraphrased duplicates. */
  semanticKey: string;
  /** Lower numbers appear first; never used to fill a quota. */
  priority: number;
  question: Exclude<R360Question, "next">;
  title: string;
  whyItMatters: string;
  statement: string;
  state?: R360PatternState;
  /** Observed period of the evidence, written for a person to read. */
  observedRange?: string;
  /** Questions for reflection, kept separate from observed behaviour and motives. */
  introspection?: R360Introspection;
  counterexample?: string;
  /** Why an exception happened, when the evidence explains it. */
  exception?: string;
  evidence: R360EvidenceRef[];
  confidence: R360Confidence;
  limitation: string;
  /** Distinct included periods required before this may be shown. */
  requiresPeriods?: number;
  /** Distinct included relationships required before this may be shown. */
  requiresRelationships?: number;
};

/** A Then / Now pair. Both sides state their own coverage; no score is implied. */
export type R360Comparison = {
  id: string;
  earlierPeriodId: string;
  laterPeriodId: string;
  then: { observation: string; coverage: string; evidence: R360EvidenceRef[] };
  now: { observation: string; coverage: string; evidence: R360EvidenceRef[] };
  note: string;
};

/**
 * A counted, comparable measurement. Both sides must share a denominator,
 * otherwise it is not shown. Qualitative reads never become numbers.
 */
export type R360Metric = {
  id: string;
  label: string;
  unit: string;
  then: { periodId: string; value: number; of: number };
  now: { periodId: string; value: number; of: number };
  missingData?: string;
};


export type R360Working = {
  id: string;
  semanticKey: string;
  statement: string;
  evidence: R360EvidenceRef[];
};

export type R360Recommendation = {
  id: string;
  semanticKey: string;
  type: "communication" | "behavioral";
  observation: string;
  action: string;
  why: string;
  evidence: R360EvidenceRef[];
  /** Self-reported outcome shipped with the fictional preview. */
  selfReport?: { used: boolean; note: string };
};

export type R360Data = {
  periods: R360Period[];
  relationships: R360Relationship[];
  sources: R360Source[];
  patterns: R360Pattern[];
  working: R360Working[];
  recommendations: R360Recommendation[];
  comparisons?: R360Comparison[];
  metrics?: R360Metric[];

};
