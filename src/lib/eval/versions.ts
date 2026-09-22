import type { EvaluationReport } from "./harness";

/**
 * Immutable prompt-version history with explicit, reviewed promotion and rollback.
 * Automatic production promotion is off: promote() requires a reviewer and a passing
 * evaluation report, and every action is appended rather than overwritten.
 */

export type PromptVersion = {
  id: string;
  kind: string;
  promptText: string;
  createdAt: string;
  parentId: string | null;
};

export type HistoryEntry = {
  at: string;
  action: "draft" | "promote" | "rollback" | "reject";
  versionId: string;
  reviewer: string;
  note: string;
};

export class PromptVersionLedger {
  private versions: PromptVersion[] = [];
  private history: HistoryEntry[] = [];
  private activeId: string | null = null;

  constructor(initial?: PromptVersion) {
    if (initial) {
      this.versions.push(initial);
      this.activeId = initial.id;
      this.history.push({
        at: initial.createdAt,
        action: "promote",
        versionId: initial.id,
        reviewer: "system",
        note: "initial baseline",
      });
    }
  }

  draft(version: PromptVersion, reviewer: string, note = "candidate drafted"): PromptVersion {
    if (this.versions.some((item) => item.id === version.id)) {
      throw new Error(`version ${version.id} already exists`);
    }
    this.versions.push(version);
    this.history.push({
      at: version.createdAt,
      action: "draft",
      versionId: version.id,
      reviewer,
      note,
    });
    return version;
  }

  /** Promotion is manual and blocked unless the frozen rubric passes. */
  promote(
    versionId: string,
    report: EvaluationReport,
    reviewer: string,
    at = new Date().toISOString(),
  ): { ok: boolean; reason?: string } {
    if (!this.versions.some((item) => item.id === versionId)) {
      return { ok: false, reason: "unknown version" };
    }
    if (!reviewer.trim()) return { ok: false, reason: "a named reviewer is required" };
    if (!report.promotionEligible) {
      this.history.push({
        at,
        action: "reject",
        versionId,
        reviewer,
        note: `blocked: ${[...report.hardFailures, ...report.regressions].join("; ") || "not eligible"}`,
      });
      return { ok: false, reason: "candidate did not pass the frozen rubric" };
    }
    this.activeId = versionId;
    this.history.push({ at, action: "promote", versionId, reviewer, note: "reviewed promotion" });
    return { ok: true };
  }

  rollback(reviewer: string, at = new Date().toISOString()): { ok: boolean; reason?: string } {
    const promotions = this.history.filter((entry) => entry.action === "promote");
    if (promotions.length < 2) return { ok: false, reason: "no earlier active version" };
    const previous = promotions[promotions.length - 2];
    this.activeId = previous.versionId;
    this.history.push({
      at,
      action: "rollback",
      versionId: previous.versionId,
      reviewer,
      note: "rolled back",
    });
    return { ok: true };
  }

  get active(): PromptVersion | null {
    return this.versions.find((item) => item.id === this.activeId) ?? null;
  }

  get log(): readonly HistoryEntry[] {
    return [...this.history];
  }
}
