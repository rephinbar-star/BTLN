import { describe, expect, it } from "vitest";
import { ADVICE_SEMANTIC_VERSION, adviceItems, applySemanticVerdicts, semanticRequest, type Participant, type Msg } from "../../../supabase/functions/_shared/adviceRecipients";
import {
  ORIGINAL_MAX_ATTEMPTS, RECOVERY_MAX_ATTEMPTS, checkItems, classifyVerdict, customerNote, evidenceFingerprint, inputFingerprint, normalizeInput,
  runRecovery, toPending, restoreVerified, type PendingItem, type RecoveryClaim, type RecoveryFinish,
} from "../../../supabase/functions/_shared/adviceReview";

const P: Participant[] = [{ id: "p1", label: "Dev", role: "user" }, { id: "p2", label: "Jo", role: "partner" }];
const M: Msg[] = [{ sender_role: "user", content: "My brother said I'm impossible to please." }, { sender_role: "partner", content: "That sounds painful. What happened?" }, { sender_role: "user", content: "He didn't want to discuss it." }];
const report = () => ({ communication_suggestions: { person1: ["Tell Jo what kind of support helps."], person2: ["Ask whether Dev wants listening or suggestions.", "Name one feeling you noticed."] }, remedial_guidance: { specific_steps: [], scripted_alternatives: [] }, advice_integrity: { deterministic_withheld: 0, review: { version: "advice-review-2", status: "unavailable", verified: 0, rejected: 0, unresolved: 3, attempts: 2, max_attempts: 2, can_retry: false, recovery: "available", can_recover: true } } });
const ok = (id: string) => ({ id, addressed_to: "recipient", action_type: "new_action", behavior_lines: [], mostly_shown_by: "n/a", premise_lines: [1], supported: "yes", evidence: [1] });
const build = (items: any) => semanticRequest(items, P, M);
const noSleep = async () => {};
const shown = (r: any) => [...r.communication_suggestions.person1, ...r.communication_suggestions.person2];

async function setup(base?: any) {
  const full = report();
  const items = adviceItems(full, P);
  const efp = await evidenceFingerprint(semanticRequest(items, P, M));
  const pending: PendingItem[] = await Promise.all(items.map((i) => toPending(full, i, ADVICE_SEMANTIC_VERSION, efp)));
  const b = base ?? report();
  if (!base) b.communication_suggestions = { person1: [], person2: [] };
  const claim: RecoveryClaim = { ok: true, base_hash: "h", result: b, pending, version: ADVICE_SEMANTIC_VERSION };
  const finishes: RecoveryFinish[] = [];
  let calls = 0;
  const deps = (model: (s: string, u: string) => Promise<unknown>, finishOk = true) => ({
    version: ADVICE_SEMANTIC_VERSION, applyVerdicts: applySemanticVerdicts, build, sleep: noSleep,
    claim: async () => claim,
    callModel: async (s: string, u: string) => { calls++; return model(s, u); },
    finish: async (f: RecoveryFinish) => { finishes.push(f); return finishOk ? { ok: true } : { ok: false, reason: "report_changed" }; },
  });
  return { deps, finishes, calls: () => calls, pending, items };
}

describe("advice-review-2 states and caps", () => {
  it("classifies: ok=verified, substantive reason=rejected, structural gap=unresolved", () => {
    expect(classifyVerdict({ ok: true, reasons: [], evidence: [1] })).toBe("verified");
    expect(classifyVerdict({ ok: false, reasons: ["semantic_addressed_to_counterpart"], evidence: [] })).toBe("rejected");
    for (const r of ["semantic_unavailable", "semantic_missing", "semantic_duplicate", "semantic_malformed"]) expect(classifyVerdict({ ok: false, reasons: [r], evidence: [] })).toBe("unresolved");
    expect(classifyVerdict(undefined)).toBe("unresolved");
  });

  it("documented caps: original = initial + 1 automatic retry; recovery = initial + 1", () => {
    expect(ORIGINAL_MAX_ATTEMPTS).toBe(2);
    expect(RECOVERY_MAX_ATTEMPTS).toBe(2);
  });

  it("original processing: initial outage then automatic success verifies everything in 2 calls", async () => {
    const items = adviceItems(report(), P);
    let n = 0;
    const out = await checkItems(items, { build, applyVerdicts: applySemanticVerdicts, maxAttempts: ORIGINAL_MAX_ATTEMPTS, backoffMs: 0, sleep: noSleep,
      callModel: async () => (++n === 1 ? null : { verdicts: items.map((_, i) => ok(`r.${i}`)).map((v, i) => ({ ...v, id: items[i].id })) }) });
    expect(out.attempts).toBe(2);
    expect([...out.states.values()].every((s) => s.state === "verified")).toBe(true);
  });

  it("original processing: total outage stops after 2 calls, all unresolved (never verified)", async () => {
    const items = adviceItems(report(), P);
    let n = 0;
    const out = await checkItems(items, { build, applyVerdicts: applySemanticVerdicts, maxAttempts: ORIGINAL_MAX_ATTEMPTS, backoffMs: 0, sleep: noSleep, callModel: async () => { n++; return null; } });
    expect(n).toBe(2);
    expect([...out.states.values()].every((s) => s.state === "unresolved")).toBe(true);
  });

  it("partial verdicts: only explicit ok items verified; retry only for unresolved", async () => {
    const items = adviceItems(report(), P);
    const seen: number[] = [];
    await checkItems(items, { build: (it) => { seen.push(it.length); return build(it); }, applyVerdicts: applySemanticVerdicts, maxAttempts: 2, backoffMs: 0, sleep: noSleep,
      callModel: async () => ({ verdicts: [{ ...ok(items[1].id) }, { ...ok(items[1].id) }] }) });
    expect(seen[0]).toBe(3);
    expect(seen[1]).toBeGreaterThanOrEqual(2);
  });

  it("recovery same input success: restores exact values and preserves earlier verified advice", async () => {
    const base = report(); base.communication_suggestions = { person1: ["Earlier verified item."], person2: [] };
    const s = await setup(base);
    const out = await runRecovery(s.deps(async () => ({ verdicts: [ok("r.0"), ok("r.1"), ok("r.2")] })));
    expect(out.ok).toBe(true);
    const f = s.finishes[0];
    expect(f.status).toBe("complete");
    expect(f.attempts).toBe(1);
    expect(f.new_result.communication_suggestions.person1).toEqual(["Earlier verified item.", "Tell Jo what kind of support helps."]);
    expect(f.new_result.advice_integrity.review.recovery).toBe("complete");
    expect(f.new_result.advice_integrity.note).toBeNull();
  });

  for (const [name, model] of [["timeout", async () => null], ["malformed JSON", async () => null], ["wrong shape", async () => ({ verdict: "yes" })]] as const) {
    it(`recovery ${name} twice: terminal, nothing new shown, plain note, 2 calls max`, async () => {
      const s = await setup();
      await runRecovery(s.deps(model as any));
      expect(s.calls()).toBe(2);
      const f = s.finishes[0];
      expect(f.status).toBe("unavailable");
      expect(shown(f.new_result)).toEqual([]);
      expect(f.new_result.advice_integrity.review.can_recover).toBe(false);
      expect(f.new_result.advice_integrity.note).toMatch(/couldn't be checked/);
      expect(f.new_result.advice_integrity.note).not.toMatch(/model|semantic|verdict/i);
    });
  }

  it("rejected items stay withheld and are not retried", async () => {
    const s = await setup();
    await runRecovery(s.deps(async () => ({ verdicts: [{ ...ok("r.0"), addressed_to: "counterpart" }, ok("r.1"), ok("r.2")] })));
    expect(s.calls()).toBe(1);
    expect(shown(s.finishes[0].new_result)).not.toContain("Tell Jo what kind of support helps.");
    expect(s.finishes[0].new_result.advice_integrity.review.rejected).toBe(1);
  });

  it("claim refusals (mismatch, absent fingerprint, used, in flight, not entitled) never call the model", async () => {
    for (const reason of ["input_mismatch", "not_recoverable", "recovery_used", "in_flight", "report_changed"]) {
      let called = 0;
      const out = await runRecovery({ version: ADVICE_SEMANTIC_VERSION, applyVerdicts: applySemanticVerdicts, build, claim: async () => ({ ok: false, reason }), callModel: async () => { called++; return null; }, finish: async () => ({ ok: true }) });
      expect(out).toEqual({ ok: false, reason });
      expect(called).toBe(0);
    }
  });

  it("stale result (report changed) is rejected by finish, not applied", async () => {
    const s = await setup();
    expect(await runRecovery(s.deps(async () => ({ verdicts: [ok("r.0"), ok("r.1"), ok("r.2")] }), false))).toEqual({ ok: false, reason: "report_changed" });
  });

  it("checker version changed: terminal without calling the model", async () => {
    const s = await setup();
    const out = await runRecovery({ ...s.deps(async () => ({})), version: "advice-semantic-99" });
    expect(out.ok).toBe(false);
    expect(s.calls()).toBe(0);
    expect(s.finishes[0].status).toBe("unavailable");
  });

  it("input fingerprint: keyed, report-bound, whitespace-normalized, not the raw hash", async () => {
    const t = "Dev: hi\r\nJo:  hello  \n\n";
    const a = await inputFingerprint("k1", "r1", t);
    expect(a).toBe(await inputFingerprint("k1", "r1", "Dev: hi\nJo: hello"));
    expect(a).not.toBe(await inputFingerprint("k2", "r1", t));
    expect(a).not.toBe(await inputFingerprint("k1", "r2", t));
    expect(a).not.toBe(await inputFingerprint("k1", "r1", "Dev: hi\nJo: hullo"));
    expect(await inputFingerprint("", "r1", t)).toBeNull();
    expect(a).not.toContain(normalizeInput(t));
  });

  it("restoreVerified puts scripts back as whole pairs; customer notes avoid jargon", () => {
    const r: any = {};
    restoreVerified(r, [{ key: "k", id: "script.0", recipient_id: "p1", counterpart_ids: ["p2"], kind: "script", text: "t", field: "script", value: { instead_of: "x", try: "t" } }]);
    expect(r.remedial_guidance.scripted_alternatives).toEqual([{ instead_of: "x", try: "t" }]);
    for (const v of [0, 2]) expect(customerNote({ status: "unavailable", verified: v, rejected: 0, unresolved: 1 })).not.toMatch(/model|semantic|verdict|JSON/i);
    expect(customerNote({ status: "unavailable", verified: 2, rejected: 0, unresolved: 1 })).toBe("Your analysis is complete. Some suggestions couldn't be checked, so we've left them out.");
  });
});
