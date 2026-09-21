import type { ExampleMessage } from "@/lib/examples/sourceFixtures";

export type R360Period = { id: string; label: string };

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

export type R360Pattern = {
  id: string;
  question: Exclude<R360Question, "next">;
  title: string;
  statement: string;
  /** Interpretation kept separate from the observed behaviour above. */
  interpretation?: string;
  counterexample?: string;
  evidence: R360EvidenceRef[];
  confidence: R360Confidence;
  limitation: string;
  /** Distinct included periods required before this may be shown. */
  requiresPeriods?: number;
  /** Distinct included relationships required before this may be shown. */
  requiresRelationships?: number;
};

export type R360Working = {
  id: string;
  statement: string;
  evidence: R360EvidenceRef[];
};

export type R360Recommendation = {
  id: string;
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
};
