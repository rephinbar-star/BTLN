import { describe, expect, it } from "vitest";
import { relationship360Preview as data } from "@/lib/relationship360/preview";
import { computeR360View, resolveEvidence } from "@/lib/relationship360/select";

const allRefs = [
  ...data.patterns.flatMap((p) => p.evidence),
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
});
