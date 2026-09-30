// Per-item advice review states (advice-review-2).
//
// Every final Deep Read advice item ends in exactly one state:
//   verified   — an explicit, well-formed semantic verdict kept it (shown)
//   rejected   — a well-formed verdict (or a deterministic rule) withheld it (never shown, never retried)
//   unresolved — no usable verdict: timeout, provider error, malformed JSON,
//                missing / duplicate / malformed verdict row (hidden)
// Passing deterministic rule checks alone is NOT verification.
//
// Attempt policy (documented caps, all server-enforced):
//   ORIGINAL processing: initial check + at most ONE automatic retry, inside the
//     original analysis while its temporary messages still exist. Nothing about
//     the conversation is kept for later.
//   RECOVERY (optional, free): once per report, the owner resubmits the SAME
//     conversation. A keyed, non-reversible server-side fingerprint of the
//     normalized input must match. The claim is atomic and consumes the single
//     recovery; inside it: initial check + at most ONE automatic retry. The
//     resubmitted text lives only in memory for that request.
//   After that the state is terminal. No background retries.
import type { AdviceItem, SemanticVerdict } from "./adviceRecipients.ts";

export const ADVICE_REVIEW_VERSION = "advice-review-2";
export const ORIGINAL_MAX_ATTEMPTS = 2;
export const RECOVERY_MAX_ATTEMPTS = 2;
/** Kept for report summaries: attempts shown to the customer refer to the original processing. */
export const REVIEW_MAX_ATTEMPTS = ORIGINAL_MAX_ATTEMPTS;
export const REVIEW_TIMEOUT_MS = 30_000;
export const REVIEW_BACKOFF_MS = 1_500;
export const INPUT_FP_VERSION = "input-fp-1";

export type ReviewState = "verified" | "rejected" | "unresolved";
export type ReviewStatus = "complete" | "unavailable";
export type RecoveryState = "not_available" | "available" | "claimed" | "complete" | "unavailable";

const UNRESOLVED = new Set([
  "semantic_unavailable", "semantic_missing", "semantic_duplicate", "semantic_malformed",
  "semantic_authors_unavailable", "semantic_no_valid_evidence",
]);

/** A verdict confers approval only when ok; any substantive rejection reason wins over "unresolved". */
export const classifyVerdict = (v: SemanticVerdict | undefined): ReviewState => {
  if (!v) return "unresolved";
  if (v.ok) return "verified";
  return v.reasons.some((r) => !UNRESOLVED.has(r)) ? "rejected" : "unresolved";
};

export type PendingItem = {
  key: string;             // hash of content + recipient + counterparts + context + checker version + evidence window
  id: string;
  recipient_id: string;
  counterpart_ids: string[];
  kind: AdviceItem["kind"];
  text: string;            // the report's own hidden suggestion (report content, never transcript)
  context?: string;
  field: "cs.person1" | "cs.person2" | "step" | "script";
  value: unknown;
};

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
export const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));

/** One-way hash of the checker window, used only inside item keys (never stored on its own). */
export const evidenceFingerprint = (req: { system: string; user: string }) => sha256(req.system + "\u0000" + req.user.split("<advice>")[0]);

export const reviewKey = (it: AdviceItem, version: string, evidenceFp: string) =>
  sha256(JSON.stringify({ v: version, text: it.text, r: it.recipient_id, c: it.counterpart_ids, k: it.kind, ctx: it.context ?? null, e: evidenceFp }));

/** Normalization for same-input matching: line endings, Unicode form, per-line whitespace, blank lines. */
export const normalizeInput = (text: string) =>
  text.normalize("NFC").replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");

/**
 * Keyed, non-reversible fingerprint (HMAC-SHA-256) of the normalized input,
 * bound to the report id so it can't be compared across reports. The key never
 * leaves the server; without it the value can't be recomputed from a guessed chat.
 */
export const inputFingerprint = async (key: string, analysisId: string, text: string) => {
  if (!key) return null;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(`btln-advice-input:${INPUT_FP_VERSION}:${key}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${analysisId}\u0000${normalizeInput(text)}`)));
};

const fieldOf = (it: AdviceItem): PendingItem["field"] =>
  it.kind === "step" ? "step" : it.kind === "script" ? "script" : it.path[1] === "person1" ? "cs.person1" : "cs.person2";

export const toPending = async (result: any, it: AdviceItem, version: string, evidenceFp: string): Promise<PendingItem> => {
  const field = fieldOf(it);
  const idx = it.path[2] as number;
  const value = field === "script" ? JSON.parse(JSON.stringify(result.remedial_guidance.scripted_alternatives[idx])) : it.text;
  return { key: await reviewKey(it, version, evidenceFp), id: it.id, recipient_id: it.recipient_id, counterpart_ids: it.counterpart_ids, kind: it.kind, text: it.text, context: it.context, field, value };
};

export const pendingAsItems = (pending: PendingItem[]): AdviceItem[] =>
  pending.map((p, i) => ({ id: `r.${i}`, path: [], recipient_id: p.recipient_id, counterpart_ids: p.counterpart_ids, kind: p.kind, text: p.text, context: p.context }));

/** Append verified pending values back into the report (after the stale check). Earlier verified items are untouched. */
export const restoreVerified = (result: any, verified: PendingItem[]) => {
  for (const p of verified) {
    if (p.field === "cs.person1" || p.field === "cs.person2") {
      const k = p.field.slice(3);
      result.communication_suggestions ??= {};
      (result.communication_suggestions[k] ??= []).push(p.value);
    } else {
      result.remedial_guidance ??= {};
      const k = p.field === "step" ? "specific_steps" : "scripted_alternatives";
      (result.remedial_guidance[k] ??= []).push(p.value);
    }
  }
};

export type ReviewSummary = {
  version: string;
  status: ReviewStatus;
  verified: number;
  rejected: number;
  unresolved: number;
  attempts: number;
  max_attempts: number;
  terminal_reason?: string | null;
  can_retry: false;              // legacy field: post-completion retry from stored text no longer exists
  recovery: RecoveryState;
  can_recover: boolean;
  recovery_attempts?: number;
};

/** Plain-language customer note. No model/verdict jargon. */
export const customerNote = (s: Pick<ReviewSummary, "status" | "rejected" | "unresolved" | "verified">): string | null => {
  if (s.status === "unavailable" && s.unresolved > 0) {
    return s.verified === 0
      ? "Your analysis is complete, but your suggestions couldn't be checked, so we've left them out rather than show advice that might be meant for the wrong person."
      : "Your analysis is complete. Some suggestions couldn't be checked, so we've left them out.";
  }
  return s.rejected ? "Some advice was held back because it didn't seem to be meant for the person it was addressed to." : null;
};

export type ModelCall = (system: string, user: string) => Promise<unknown | null>; // null = timeout/provider/malformed
export type ApplyVerdicts = (items: AdviceItem[], parsed: unknown, range: { firstIndex: number; lastIndex: number; senders: string[] }) => Map<string, SemanticVerdict>;
export type BuildRequest = (items: AdviceItem[]) => { system: string; user: string; firstIndex: number; lastIndex: number; senders: string[] };

/** Bounded check loop shared by original processing and recovery: at most `maxAttempts`, only unresolved items retried. */
export const checkItems = async (items: AdviceItem[], d: { build: BuildRequest; callModel: ModelCall; applyVerdicts: ApplyVerdicts; maxAttempts: number; backoffMs: number; sleep?: (ms: number) => Promise<void> }) => {
  const states = new Map<string, { state: ReviewState; reasons: string[] }>();
  const trace: unknown[] = [];
  let unresolved = items;
  let attempts = 0;
  while (unresolved.length && attempts < d.maxAttempts) {
    if (attempts > 0) await (d.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))))(d.backoffMs);
    attempts++;
    const rq = d.build(unresolved);
    const parsed = await d.callModel(rq.system, rq.user);
    const verdicts = d.applyVerdicts(unresolved, parsed, rq);
    for (const it of unresolved) { const v = verdicts.get(it.id); states.set(it.id, { state: classifyVerdict(v), reasons: v?.reasons ?? ["semantic_missing"] }); }
    trace.push({ attempt: attempts, parsed: parsed !== null, response: parsed, verdicts: Object.fromEntries(verdicts) });
    unresolved = unresolved.filter((it) => states.get(it.id)!.state === "unresolved");
  }
  for (const it of items) if (!states.has(it.id)) states.set(it.id, { state: "unresolved", reasons: ["semantic_unavailable"] });
  return { states, attempts, trace };
};

export type RecoveryClaim =
  | { ok: true; version: string; pending: PendingItem[]; result: any; base_hash: string }
  | { ok: false; reason: string };
export type RecoveryFinish = { base_hash: string; new_result: any | null; status: ReviewStatus; attempts: number; terminal_reason: string | null };
export type RecoveryDeps = {
  claim: () => Promise<RecoveryClaim>;
  finish: (f: RecoveryFinish) => Promise<{ ok: boolean; reason?: string }>;
  build: BuildRequest;
  callModel: ModelCall;
  applyVerdicts: ApplyVerdicts;
  version: string;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * One recovery: claim (atomic, consumes the single recovery), check only the
 * report's hidden items against the resubmitted same conversation, restore the
 * verified ones, finish with a stale-report guard. Never generates new advice.
 */
export const runRecovery = async (d: RecoveryDeps) => {
  const c = await d.claim();
  if (c.ok === false) return { ok: false as const, reason: c.reason };
  if (c.version !== d.version) {
    const f = await d.finish({ base_hash: c.base_hash, new_result: null, status: "unavailable", attempts: 0, terminal_reason: "checker_version_changed" });
    return { ok: false as const, reason: f.ok ? "checker_version_changed" : f.reason ?? "stale" };
  }
  const items = pendingAsItems(c.pending);
  const { states, attempts } = await checkItems(items, { build: d.build, callModel: d.callModel, applyVerdicts: d.applyVerdicts, maxAttempts: RECOVERY_MAX_ATTEMPTS, backoffMs: REVIEW_BACKOFF_MS, sleep: d.sleep });
  const verified: PendingItem[] = [];
  let rejected = 0, remaining = 0;
  items.forEach((it, i) => {
    const s = states.get(it.id)!.state;
    if (s === "verified") verified.push(c.pending[i]);
    else if (s === "rejected") rejected++;
    else remaining++;
  });
  const status: ReviewStatus = remaining === 0 ? "complete" : "unavailable";
  const result = JSON.parse(JSON.stringify(c.result));
  restoreVerified(result, verified);
  const ai = result.advice_integrity ?? {};
  const prev = ai.review ?? {};
  const recovery: RecoveryState = status === "complete" ? "complete" : "unavailable";
  const review: ReviewSummary = {
    version: prev.version ?? ADVICE_REVIEW_VERSION, status,
    verified: (prev.verified ?? 0) + verified.length, rejected: (prev.rejected ?? 0) + rejected, unresolved: remaining,
    attempts: prev.attempts ?? 0, max_attempts: prev.max_attempts ?? ORIGINAL_MAX_ATTEMPTS,
    can_retry: false, recovery, can_recover: false, recovery_attempts: attempts,
    terminal_reason: status === "unavailable" ? "recovery_exhausted" : null,
  };
  result.advice_integrity = { ...ai, review, withheld_count: review.rejected + review.unresolved + (ai.deterministic_withheld ?? 0), note: customerNote(review) };
  const f = await d.finish({ base_hash: c.base_hash, new_result: result, status, attempts, terminal_reason: review.terminal_reason ?? null });
  if (!f.ok) return { ok: false as const, reason: f.reason ?? "stale" };
  return { ok: true as const, review, restored: verified.length, rejected, remaining, attempts };
};
