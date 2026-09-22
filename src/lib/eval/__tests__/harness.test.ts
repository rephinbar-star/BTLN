import { describe, expect, it } from "vitest";
import {
  BASELINE_OUTPUTS,
  EVAL_CASES,
  FLATTERING_CANDIDATE_OUTPUTS,
  GOOD_CANDIDATE_OUTPUTS,
  runsFrom,
} from "../fixtures";
import { evaluateCandidate, proposeCandidates, MIN_SAMPLE_FOR_CANDIDATE } from "../harness";
import { PromptVersionLedger } from "../versions";
import { scoreOutput } from "../rubric";

const baseline = runsFrom(BASELINE_OUTPUTS);

describe("frozen Deep Read rubric", () => {
  it("passes every hard criterion on the baseline", () => {
    for (const testCase of EVAL_CASES) {
      const results = scoreOutput(testCase, BASELINE_OUTPUTS[testCase.id]);
      for (const criterion of results.filter((item) => item.hard)) {
        expect(criterion.passed, `${testCase.id}/${criterion.id}: ${criterion.detail}`).toBe(true);
      }
    }
  });

  it("fails a candidate that agrees with an unsupported premise", () => {
    const results = scoreOutput(EVAL_CASES[0], FLATTERING_CANDIDATE_OUTPUTS["case-late-replies"]);
    expect(results.find((item) => item.id === "no_flattery")?.passed).toBe(false);
    expect(results.find((item) => item.id === "uncertainty")?.passed).toBe(false);
  });

  it("fails clinical labels and mind-reading", () => {
    const results = scoreOutput(EVAL_CASES[1], FLATTERING_CANDIDATE_OUTPUTS["case-repair-attempt"]);
    expect(results.find((item) => item.id === "no_diagnosis")?.passed).toBe(false);
  });
});

describe("candidate evaluation", () => {
  it("marks a grounded improvement as eligible for review", () => {
    const report = evaluateCandidate(EVAL_CASES, baseline, runsFrom(GOOD_CANDIDATE_OUTPUTS));
    expect(report.hardFailures).toEqual([]);
    expect(report.regressions).toEqual([]);
    expect(report.promotionEligible).toBe(true);
  });

  it("rejects a rater-pleasing candidate that breaks invariants", () => {
    const report = evaluateCandidate(EVAL_CASES, baseline, runsFrom(FLATTERING_CANDIDATE_OUTPUTS));
    expect(report.promotionEligible).toBe(false);
    expect(report.hardFailures.length).toBeGreaterThan(0);
  });
});

describe("candidate proposals from aggregated feedback", () => {
  it("ignores issues below the minimum sample size", () => {
    expect(
      proposeCandidates([
        {
          sourceKind: "deep_read",
          targetKind: "section",
          reasonCode: "too_generic",
          upCount: 0,
          downCount: 5,
          sampleSize: MIN_SAMPLE_FOR_CANDIDATE - 1,
        },
      ]),
    ).toEqual([]);
  });

  it("surfaces well-supported issues with drafting guidance", () => {
    const proposals = proposeCandidates([
      {
        sourceKind: "deep_read",
        targetKind: "section",
        reasonCode: "too_generic",
        upCount: 10,
        downCount: 30,
        sampleSize: 40,
      },
    ]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].suggestedGuidance).toMatch(/specific/i);
  });
});

describe("prompt version ledger", () => {
  const baseVersion = {
    id: "v1",
    kind: "deep_read",
    promptText: "baseline",
    createdAt: "2026-01-01T00:00:00Z",
    parentId: null,
  };

  it("blocks promotion of a failing candidate and records the rejection", () => {
    const ledger = new PromptVersionLedger(baseVersion);
    ledger.draft(
      { ...baseVersion, id: "v2", promptText: "candidate", parentId: "v1" },
      "operator",
    );
    const failing = evaluateCandidate(EVAL_CASES, baseline, runsFrom(FLATTERING_CANDIDATE_OUTPUTS));
    const result = ledger.promote("v2", failing, "operator");
    expect(result.ok).toBe(false);
    expect(ledger.active?.id).toBe("v1");
    expect(ledger.log.some((entry) => entry.action === "reject")).toBe(true);
  });

  it("promotes a passing candidate and can roll back", () => {
    const ledger = new PromptVersionLedger(baseVersion);
    ledger.draft({ ...baseVersion, id: "v2", promptText: "candidate", parentId: "v1" }, "operator");
    const passing = evaluateCandidate(EVAL_CASES, baseline, runsFrom(GOOD_CANDIDATE_OUTPUTS));
    expect(ledger.promote("v2", passing, "operator").ok).toBe(true);
    expect(ledger.active?.id).toBe("v2");
    expect(ledger.rollback("operator").ok).toBe(true);
    expect(ledger.active?.id).toBe("v1");
  });

  it("requires a named reviewer", () => {
    const ledger = new PromptVersionLedger(baseVersion);
    ledger.draft({ ...baseVersion, id: "v2", promptText: "candidate", parentId: "v1" }, "operator");
    const passing = evaluateCandidate(EVAL_CASES, baseline, runsFrom(GOOD_CANDIDATE_OUTPUTS));
    expect(ledger.promote("v2", passing, "  ").ok).toBe(false);
  });
});
