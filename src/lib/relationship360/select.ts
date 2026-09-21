import type { R360Data, R360EvidenceRef, R360Pattern, R360Question, R360Recommendation, R360Source, R360Working } from "@/lib/relationship360/types";

export const QUESTION_LABELS: Record<R360Question, string> = {
  noticing: "What am I noticing in my relationships?",
  repeating: "What keeps happening?",
  changed: "What has changed?",
  across: "Does this happen with different people?",
  next: "What can I do next?",
};

export type ResolvedEvidence = {
  sourceId: string;
  sourceLabel: string;
  product: string;
  observedRange: string;
  sender: string;
  text: string;
  ts: string;
};

export const resolveEvidence = (data: R360Data, refs: R360EvidenceRef[]): ResolvedEvidence[] =>
  refs.flatMap((ref) => {
    const source = data.sources.find((s) => s.id === ref.sourceId);
    const message = source?.messages.find((msg) => msg.id === ref.messageId);
    if (!source || !message) return [];
    return [{
      sourceId: source.id,
      sourceLabel: source.label,
      product: source.product,
      observedRange: source.observedRange,
      sender: message.sender,
      text: message.text,
      ts: message.ts,
    }];
  });

export type R360View = {
  includedSources: R360Source[];
  patterns: R360Pattern[];
  working: R360Working[];
  recommendations: R360Recommendation[];
  /** Patterns withheld because their evidence is no longer included. */
  withheld: { title: string; reason: string }[];
};

/** Keep the first editorially-prioritized item for each meaning, not each wording. */
export const distinctByMeaning = <T extends { semanticKey: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.semanticKey)) return false;
    seen.add(item.semanticKey);
    return true;
  });
};

/**
 * Recalculates what may honestly be shown from the currently included sources.
 * Recurrence needs independent periods; cross-relationship claims need distinct
 * relationships; anything whose evidence was excluded is withheld, not softened.
 */
export const computeR360View = (data: R360Data, excluded: Set<string>): R360View => {
  const includedSources = data.sources.filter((s) => !excluded.has(s.id));
  const includedIds = new Set(includedSources.map((s) => s.id));
  const withheld: R360View["withheld"] = [];

  const evidenceIn = (refs: R360EvidenceRef[]) => refs.filter((r) => includedIds.has(r.sourceId));

  const patterns = data.patterns.filter((pattern) => {
    const kept = evidenceIn(pattern.evidence);
    if (kept.length === 0) {
      withheld.push({ title: pattern.title, reason: "No included conversation supports this any more." });
      return false;
    }
    const periods = new Set(kept.map((r) => data.sources.find((s) => s.id === r.sourceId)?.periodId));
    const relationships = new Set(kept.map((r) => data.sources.find((s) => s.id === r.sourceId)?.relationshipId));
    if (pattern.requiresPeriods && periods.size < pattern.requiresPeriods) {
      withheld.push({ title: pattern.title, reason: "Needs evidence from more than one period." });
      return false;
    }
    if (pattern.requiresRelationships && relationships.size < pattern.requiresRelationships) {
      withheld.push({ title: pattern.title, reason: "Needs evidence from more than one relationship." });
      return false;
    }
    return true;
  }).map((pattern) => ({
    ...pattern,
    evidence: evidenceIn(pattern.evidence),
    introspection: pattern.introspection
      ? {
          ...pattern.introspection,
          paths: pattern.introspection.paths
            .map((path) => ({ ...path, evidenceRefs: evidenceIn(path.evidenceRefs) }))
            .filter((path) => path.evidenceRefs.length > 0),
        }
      : undefined,
  })).sort((a, b) => a.priority - b.priority);

  const working = data.working
    .map((item) => ({ ...item, evidence: evidenceIn(item.evidence) }))
    .filter((item) => item.evidence.length > 0);

  const recommendations = data.recommendations
    .map((rec) => ({ ...rec, evidence: evidenceIn(rec.evidence) }))
    .filter((rec) => rec.evidence.length > 0);

  return { includedSources, patterns, working, recommendations, withheld };
};
