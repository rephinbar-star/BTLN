import {
  DEEP_READ_RUBRIC_VERSION,
  overallScore,
  scoreOutput,
  type CriterionResult,
  type EvalCase,
  type EvalOutput,
} from "./rubric";

/**
 * Bounded offline evaluation harness.
 *
 * It compares a candidate prompt's outputs against the current baseline on held-out
 * synthetic cases. It never promotes anything automatically and never optimises for
 * agreement: ratings cannot override the frozen rubric.
 */

export type CandidateRun = {
  caseId: string;
  output: EvalOutput;
};

export type CaseComparison = {
  caseId: string;
  baseline: CriterionResult[];
  candidate: CriterionResult[];
  regressions: string[];
  improvements: string[];
};

export type EvaluationReport = {
  rubricVersion: string;
  caseCount: number;
  baselineScore: number;
  candidateScore: number;
  hardFailures: string[];
  regressions: string[];
  improvements: string[];
  /** Eligible for a human to review and promote. Never an automatic promotion. */
  promotionEligible: boolean;
  cases: CaseComparison[];
};

const byId = (runs: CandidateRun[]) => new Map(runs.map((run) => [run.caseId, run.output]));

export const evaluateCandidate = (
  cases: EvalCase[],
  baselineRuns: CandidateRun[],
  candidateRuns: CandidateRun[],
): EvaluationReport => {
  const baseline = byId(baselineRuns);
  const candidate = byId(candidateRuns);

  const comparisons: CaseComparison[] = [];
  const hardFailures: string[] = [];
  const allRegressions: string[] = [];
  const allImprovements: string[] = [];
  let baselineTotal = 0;
  let candidateTotal = 0;

  for (const testCase of cases) {
    const baselineOutput = baseline.get(testCase.id);
    const candidateOutput = candidate.get(testCase.id);
    if (!baselineOutput || !candidateOutput) {
      hardFailures.push(`${testCase.id}: missing run`);
      continue;
    }
    const baselineResults = scoreOutput(testCase, baselineOutput);
    const candidateResults = scoreOutput(testCase, candidateOutput);
    baselineTotal += overallScore(baselineResults);
    candidateTotal += overallScore(candidateResults);

    const regressions: string[] = [];
    const improvements: string[] = [];
    for (const criterion of candidateResults) {
      const before = baselineResults.find((item) => item.id === criterion.id);
      if (criterion.hard && !criterion.passed) {
        hardFailures.push(`${testCase.id}/${criterion.id}: ${criterion.detail}`);
      }
      if (before && criterion.score < before.score - 0.001) {
        regressions.push(`${testCase.id}/${criterion.id}`);
      }
      if (before && criterion.score > before.score + 0.001) {
        improvements.push(`${testCase.id}/${criterion.id}`);
      }
    }
    allRegressions.push(...regressions);
    allImprovements.push(...improvements);
    comparisons.push({
      caseId: testCase.id,
      baseline: baselineResults,
      candidate: candidateResults,
      regressions,
      improvements,
    });
  }

  const count = comparisons.length || 1;
  return {
    rubricVersion: DEEP_READ_RUBRIC_VERSION,
    caseCount: comparisons.length,
    baselineScore: baselineTotal / count,
    candidateScore: candidateTotal / count,
    hardFailures,
    regressions: allRegressions,
    improvements: allImprovements,
    promotionEligible:
      comparisons.length > 0 &&
      hardFailures.length === 0 &&
      allRegressions.length === 0 &&
      candidateTotal >= baselineTotal,
    cases: comparisons,
  };
};

/** Aggregated, content-free feedback signal used to suggest what to look at. */
export type FeedbackAggregateRow = {
  sourceKind: string;
  targetKind: string;
  reasonCode: string | null;
  upCount: number;
  downCount: number;
  sampleSize: number;
};

export type CandidateProposal = {
  issue: string;
  sourceKind: string;
  targetKind: string;
  reasonCode: string;
  sampleSize: number;
  downShare: number;
  /** Guidance to draft into a candidate prompt. A human writes and reviews the change. */
  suggestedGuidance: string;
};

const GUIDANCE: Record<string, string> = {
  misread_speaker:
    "Re-state who said what from the confirmed speaker mapping before interpreting, and say so when attribution is uncertain.",
  missing_context:
    "Name what the transcript does not cover and mark the reading as partial instead of filling the gap.",
  too_generic:
    "Tie every next step to a specific quoted moment and a concrete wording the person can use.",
  repetitive: "Say each observation once, in its canonical place, and cross-reference instead of repeating.",
  too_certain: "Lower confidence language where evidence is thin and give the competing reading.",
  unhelpful_suggestion: "Make each suggestion actionable within one conversation and state what it is for.",
  tone_off: "Match a plain, practical tone; drop praise and drama that the evidence does not carry.",
  inaccurate: "Check each claim against its cited messages and drop claims the evidence cannot carry.",
  not_funny: "Use grounded callbacks from the transcript rather than generic joke templates.",
  too_harsh: "Keep jokes about behaviour in the chat, never about the person's worth or appearance.",
};

/** Minimum ratings before an issue is worth acting on at all. */
export const MIN_SAMPLE_FOR_CANDIDATE = 20;
const MIN_DOWN_SHARE = 0.25;

export const proposeCandidates = (rows: FeedbackAggregateRow[]): CandidateProposal[] =>
  rows
    .filter((row) => row.reasonCode && row.sampleSize >= MIN_SAMPLE_FOR_CANDIDATE)
    .map((row) => ({
      issue: `${row.sourceKind} · ${row.targetKind} · ${row.reasonCode}`,
      sourceKind: row.sourceKind,
      targetKind: row.targetKind,
      reasonCode: row.reasonCode as string,
      sampleSize: row.sampleSize,
      downShare: row.sampleSize > 0 ? row.downCount / row.sampleSize : 0,
      suggestedGuidance:
        GUIDANCE[row.reasonCode as string] ??
        "Review sampled synthetic cases for this section before drafting a change.",
    }))
    .filter((proposal) => proposal.downShare >= MIN_DOWN_SHARE)
    .sort((a, b) => b.downShare - a.downShare || b.sampleSize - a.sampleSize);
