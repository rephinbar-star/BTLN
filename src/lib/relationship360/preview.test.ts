import { describe, expect, it } from "vitest";
import { relationship360Preview as data } from "@/lib/relationship360/preview";
import { computeR360View, resolveEvidence } from "@/lib/relationship360/select";

const allRefs = [
  ...data.patterns.flatMap((p) => p.evidence),
  ...data.patterns.flatMap((p) => p.introspection?.paths.flatMap((path) => path.evidenceRefs) ?? []),
  ...data.working.flatMap((w) => w.evidence),
  ...data.recommendations.flatMap((r) => r.evidence),
];

describe("Relationship360 preview fixture", () => {
  it("every quoted piece of evidence exists in the sample conversations", () => {
    expect(allRefs.length).toBeGreaterThan(0);
    expect(resolveEvidence(data, allRefs)).toHaveLength(allRefs.length);
  });

  it("covers at least three relationships and three periods", () => {
    expect(new Set(data.sources.map((s) => s.relationshipId)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(data.sources.map((s) => s.periodId)).size).toBeGreaterThanOrEqual(3);
  });

  it("withholds a recurrence claim once its second period is excluded", () => {
    const before = computeR360View(data, new Set());
    const after = computeR360View(data, new Set(["s3"]));
    expect(before.patterns.some((p) => p.question === "repeating")).toBe(true);
    expect(after.patterns.some((p) => p.question === "repeating")).toBe(false);
    expect(after.withheld.length).toBeGreaterThan(0);
  });

  it("grounds introspection paths in source messages and phrases coaching as questions", () => {
    for (const pattern of data.patterns) {
      expect(pattern.introspection).toBeDefined();
      const introspection = pattern.introspection;
      if (!introspection) continue;
      expect(introspection.openingQuestion.trim().endsWith("?")).toBe(true);
      expect(introspection.closingQuestion.trim().endsWith("?")).toBe(true);
      expect(introspection.paths.length).toBeGreaterThan(0);
      expect(introspection.paths.length).toBeLessThanOrEqual(3);
      if (introspection.suggestedNextStepId) {
        expect(data.recommendations.some((recommendation) => recommendation.id === introspection.suggestedNextStepId)).toBe(true);
      }
      for (const path of introspection.paths) {
        expect(resolveEvidence(data, path.evidenceRefs)).toHaveLength(path.evidenceRefs.length);
        expect(path.questions.every((question) => question.includes("?"))).toBe(true);
      }
    }
  });

  it("keeps sparse introspection grounded and includes strength and rejected-alternative cases", () => {
    const sparse = computeR360View(data, new Set(data.sources.filter((source) => source.id !== "s2").map((source) => source.id)));
    expect(sparse.patterns.every((pattern) => pattern.introspection?.paths.every((path) => path.evidenceRefs.every((ref) => ref.sourceId === "s2")) ?? true)).toBe(true);
    expect(data.patterns.some((pattern) => pattern.introspection?.paths.some((path) => path.label.toLowerCase().includes("boundary")))).toBe(true);
    expect(data.patterns.some((pattern) => pattern.introspection?.selfReportedReflection?.includes("doesn't fit"))).toBe(true);
  });
});
