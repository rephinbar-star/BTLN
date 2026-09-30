import { describe, expect, it } from "vitest";
import { ADVICE_SEMANTIC_VERSION, adviceItems, applySemanticVerdicts, semanticRequest, type Participant, type Msg } from "../../../supabase/functions/_shared/adviceRecipients";
import { classifyVerdict, customerNote, evidenceFingerprint, runReviewRetry, toPending, restoreVerified, type ClaimResult, type FinishInput, type PendingItem } from "../../../supabase/functions/_shared/adviceReview";

const P: Participant[] = [{ id: "p1", label: "Dev", role: "user" }, { id: "p2", label: "Jo", role: "partner" }];
const M: Msg[] = [{ sender_role: "user", content: "My brother said I'm impossible to please." }, { sender_role: "partner", content: "That sounds painful. What happened?" }, { sender_role: "user", content: "He didn't want to discuss it." }];
const report = () => ({ communication_suggestions: { person1: ["Tell Jo what kind of support helps."], person2: ["Ask whether Dev wants listening or suggestions.", "Name one feeling you noticed."] }, remedial_guidance: { specific_steps: [], scripted_alternatives: [] }, advice_integrity: { deterministic_withheld: 0, review: { version: "advice-review-1", status: "pending", verified: 0, rejected: 0, unresolved: 3, attempts: 2, max_attempts: 3, can_retry: true } } });
const ok = (id: string) => ({ id, addressed_to: "recipient", action_type: "new_action", behavior_lines: [], mostly_shown_by: "n/a", premise_lines: [1], supported: "yes", evidence: [1] });

async function setup(attempt = 3) {
  const full = report();
  const items = adviceItems(full, P);
  const req = semanticRequest(items, P, M);
  const efp = await evidenceFingerprint(req);
  const pending: PendingItem[] = await Promise.all(items.map((i) => toPending(full, i, ADVICE_SEMANTIC_VERSION, efp)));
  const base = report();
  base.communication_suggestions = { person1: [], person2: [] }; // all hidden while pending
  const claim: ClaimResult = { ok: true, attempt, max_attempts: 3, base_hash: "h", result: base, pending, version: ADVICE_SEMANTIC_VERSION,
    evidence: { system: req.system, transcript: req.user.split("<advice>")[0], firstIndex: req.firstIndex, lastIndex: req.lastIndex, senders: req.senders } };
  const finishes: FinishInput[] = [];
  let calls = 0;
  const deps = (model: (s: string, u: string) => Promise<unknown>, finishOk = true) => ({
    version: ADVICE_SEMANTIC_VERSION, applyVerdicts: applySemanticVerdicts,
    claim: async () => claim,
    callModel: async (s: string, u: string) => { calls++; return model(s, u); },
    finish: async (f: FinishInput) => { finishes.push(f); return finishOk ? { ok: true } : { ok: false, reason: "report_changed" }; },
  });
  return { deps, finishes, calls: () => calls, pending };
}
const shown = (r: any) => [...r.communication_suggestions.person1, ...r.communication_suggestions.person2];

describe("advice-review-1 per-item states", () => {
  it("classifies: ok=verified, substantive reason=rejected, structural gap=unresolved", () => {
    expect(classifyVerdict({ ok: true, reasons: [], evidence: [1] })).toBe("verified");
    expect(classifyVerdict({ ok: false, reasons: ["semantic_addressed_to_counterpart"], evidence: [] })).toBe("rejected");
    expect(classifyVerdict({ ok: false, reasons: ["semantic_malformed", "semantic_behavior_lines_not_recipients"], evidence: [] })).toBe("rejected");
    for (const r of ["semantic_unavailable", "semantic_missing", "semantic_duplicate", "semantic_malformed"]) expect(classifyVerdict({ ok: false, reasons: [r], evidence: [] })).toBe("unresolved");
    expect(classifyVerdict(undefined)).toBe("unresolved");
  });

  for (const [name, model] of [["timeout", async () => null], ["provider error", async () => null], ["malformed JSON", async () => null], ["wrong shape", async () => ({ verdict: "yes" })]] as const) {
    it(`${name} on the final attempt: nothing shown, terminal unavailable, plain note`, async () => {
      const s = await setup(3);
      const out = await runReviewRetry(s.deps(model as any));
      expect(out.ok).toBe(true);
      const f = s.finishes[0];
      expect(f.status).toBe("unavailable");
      expect(shown(f.new_result)).toEqual([]);
      expect(f.new_result.advice_integrity.note).toMatch(/couldn't finish checking/);
      expect(f.new_result.advice_integrity.note).not.toMatch(/model|semantic|verdict/i);
    });
  }

  it("partial / missing / duplicate verdicts: only the explicit ok item is restored; others stay pending when attempts remain", async () => {
    const s = await setup(2);
    await runReviewRetry(s.deps(async () => ({ verdicts: [ok("r.1"), ok("r.2"), ok("r.2")] })));
    const f = s.finishes[0];
    expect(shown(f.new_result)).toEqual(["Ask whether Dev wants listening or suggestions."]);
    expect(f.status).toBe("pending");
    expect(f.remaining.map((p) => p.text).sort()).toEqual(["Name one feeling you noticed.", "Tell Jo what kind of support helps."]);
  });

  it("rejected items stay withheld and are not retried", async () => {
    const s = await setup(2);
    await runReviewRetry(s.deps(async () => ({ verdicts: [{ ...ok("r.0"), addressed_to: "counterpart" }, ok("r.1"), ok("r.2")] })));
    const f = s.finishes[0];
    expect(f.status).toBe("complete");
    expect(shown(f.new_result)).not.toContain("Tell Jo what kind of support helps.");
    expect(f.remaining).toEqual([]);
    expect(f.new_result.advice_integrity.review.rejected).toBe(1);
  });

  it("retry success restores the exact stored values and preserves earlier verified advice", async () => {
    const s = await setup(3);
    const r = report(); r.communication_suggestions = { person1: ["Earlier verified item."], person2: [] };
    const d = s.deps(async () => ({ verdicts: [ok("r.0"), ok("r.1"), ok("r.2")] }));
    const c = await d.claim(); (c as any).result = r;
    await runReviewRetry({ ...d, claim: async () => c });
    const f = s.finishes[0];
    expect(f.status).toBe("complete");
    expect(f.new_result.communication_suggestions.person1).toEqual(["Earlier verified item.", "Tell Jo what kind of support helps."]);
    expect(f.new_result.advice_integrity.note).toBeNull();
  });

  it("cap exhausted / in flight / expired evidence: no model call", async () => {
    for (const reason of ["attempts_exhausted", "in_flight", "evidence_expired", "terminal_unavailable", "too_soon"]) {
      let called = 0;
      const out = await runReviewRetry({ version: ADVICE_SEMANTIC_VERSION, applyVerdicts: applySemanticVerdicts, claim: async () => ({ ok: false, reason }), callModel: async () => { called++; return null; }, finish: async () => ({ ok: true }) });
      expect(out).toEqual({ ok: false, reason });
      expect(called).toBe(0);
    }
  });

  it("stale result (report changed) is rejected by finish and reported, not applied", async () => {
    const s = await setup(3);
    const out = await runReviewRetry(s.deps(async () => ({ verdicts: [ok("r.0"), ok("r.1"), ok("r.2")] }), false));
    expect(out).toEqual({ ok: false, reason: "report_changed" });
  });

  it("checker version changed: terminal without calling the model", async () => {
    const s = await setup(3);
    const d = s.deps(async () => ({}));
    const out = await runReviewRetry({ ...d, version: "advice-semantic-99" });
    expect(out.ok).toBe(false);
    expect(s.calls()).toBe(0);
    expect(s.finishes[0].status).toBe("unavailable");
  });

  it("pending keys bind content, recipient and evidence", async () => {
    const s = await setup(3);
    const again = await setup(3);
    expect(s.pending.map((p) => p.key)).toEqual(again.pending.map((p) => p.key));
    expect(new Set(s.pending.map((p) => p.key)).size).toBe(3);
  });

  it("restoreVerified puts scripts back as whole pairs; customer notes avoid jargon", () => {
    const r: any = {};
    restoreVerified(r, [{ key: "k", id: "script.0", recipient_id: "p1", counterpart_ids: ["p2"], kind: "script", text: "t", field: "script", value: { instead_of: "x", try: "t" } }]);
    expect(r.remedial_guidance.scripted_alternatives).toEqual([{ instead_of: "x", try: "t" }]);
    for (const st of ["pending", "unavailable"] as const) for (const v of [0, 2]) expect(customerNote({ status: st, verified: v, rejected: 0, unresolved: 1 })).not.toMatch(/model|semantic|verdict|JSON/i);
  });
});
