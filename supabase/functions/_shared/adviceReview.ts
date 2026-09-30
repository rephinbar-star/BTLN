// Per-item advice review states (advice-review-1).
//
// Every final Deep Read advice item ends in exactly one state:
//   verified   — an explicit, well-formed semantic verdict kept it (shown)
//   rejected   — a well-formed verdict (or a deterministic rule) withheld it (never shown, never retried)
//   unresolved — the review did not produce a usable verdict for it: timeout,
//                provider error, malformed JSON, missing / duplicate / malformed
//                verdict row (hidden; may be retried within a hard cap)
// Passing deterministic rule checks alone is NOT verification: unresolved items
// are never shown as advice. Partial verdicts are salvaged only from a
// structurally valid response ({"verdicts":[...]}); malformed JSON salvages nothing.
//
// Retry policy (shared by automatic and manual attempts, enforced in the DB):
//   REVIEW_MAX_ATTEMPTS = 3 → initial check + one automatic retry inside the
//   original analysis (raw messages still present) + one customer-triggered
//   "Finish checking suggestions" attempt. After that the state is terminal.
//   Manual retries use only the bounded transcript window the check already
//   read, kept for REVIEW_EVIDENCE_TTL_MS and cleared on completion, exhaustion,
//   staleness, expiry or report deletion. Nothing else is retained.
import type { AdviceItem, SemanticVerdict } from "./adviceRecipients.ts";

export const ADVICE_REVIEW_VERSION = "advice-review-1";
export const REVIEW_MAX_ATTEMPTS = 3;
export const REVIEW_TIMEOUT_MS = 30_000;
export const REVIEW_BACKOFF_MS = 1_500;
export const REVIEW_EVIDENCE_TTL_MS = 2 * 60 * 60 * 1000;

export type ReviewState = "verified" | "rejected" | "unresolved";
export type ReviewStatus = "complete" | "pending" | "unavailable";

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
  key: string;             // hash of content + recipient + counterparts + context + checker version + evidence
  id: string;              // id at the time it was hidden (for tracing only; merges use key)
  recipient_id: string;
  counterpart_ids: string[];
  kind: AdviceItem["kind"];
  text: string;
  context?: string;
  field: "cs.person1" | "cs.person2" | "step" | "script";
  value: unknown;          // exact stored value to restore (string, or the whole scripted pair)
};

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
export const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));

/** Fingerprint of the transcript window + checker instructions the verdict was based on. */
export const evidenceFingerprint = (req: { system: string; user: string }) => sha256(req.system + "\u0000" + req.user.split("<advice>")[0]);

export const reviewKey = (it: AdviceItem, version: string, evidenceFp: string) =>
  sha256(JSON.stringify({ v: version, text: it.text, r: it.recipient_id, c: it.counterpart_ids, k: it.kind, ctx: it.context ?? null, e: evidenceFp }));

const fieldOf = (it: AdviceItem): PendingItem["field"] =>
  it.kind === "step" ? "step" : it.kind === "script" ? "script" : it.path[1] === "person1" ? "cs.person1" : "cs.person2";

export const toPending = async (result: any, it: AdviceItem, version: string, evidenceFp: string): Promise<PendingItem> => {
  const field = fieldOf(it);
  const idx = it.path[2] as number;
  const value = field === "script" ? JSON.parse(JSON.stringify(result.remedial_guidance.scripted_alternatives[idx])) : it.text;
  return { key: await reviewKey(it, version, evidenceFp), id: it.id, recipient_id: it.recipient_id, counterpart_ids: it.counterpart_ids, kind: it.kind, text: it.text, context: it.context, field, value };
};

/** Rebuild an AdviceItem from a pending record so the stored request can be re-sent. Ids are positional within the retry only. */
export const pendingAsItems = (pending: PendingItem[]): AdviceItem[] =>
  pending.map((p, i) => ({ id: `r.${i}`, path: [], recipient_id: p.recipient_id, counterpart_ids: p.counterpart_ids, kind: p.kind, text: p.text, context: p.context }));

/** Append verified pending values back into the report. Only called after the stale check passed. */
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
  can_retry: boolean;
};

/** Plain-language customer note. No model/verdict jargon. */
export const customerNote = (s: Pick<ReviewSummary, "status" | "rejected" | "unresolved" | "verified">): string | null => {
  if (s.status === "pending") {
    return s.verified === 0
      ? "Your analysis is complete, but we're still checking your suggestions to make sure each one is meant for the right person. They'll appear here once that check finishes."
      : "Your analysis is complete. A few suggestions are still being checked to make sure they're meant for the right person, so they're hidden for now.";
  }
  if (s.status === "unavailable") {
    return s.verified === 0
      ? "Your analysis is complete, but we couldn't finish checking your suggestions, so we've left them out rather than show advice that might be meant for the wrong person."
      : "Your analysis is complete. We couldn't finish checking a few suggestions, so we've left those out rather than show advice that might be meant for the wrong person.";
  }
  return s.rejected ? "Some advice was held back because it didn't seem to be meant for the person it was addressed to." : null;
};

/** Retry cycle with injected dependencies (DB claim/finish, model call) so outages and races are testable without a model. */
export type ClaimResult =
  | { ok: true; attempt: number; max_attempts: number; base_hash: string; result: any; pending: PendingItem[]; evidence: { system: string; transcript: string; firstIndex: number; lastIndex: number; senders: string[] }; version: string }
  | { ok: false; reason: string };
export type FinishInput = { attempt: number; base_hash: string; new_result: any | null; remaining: PendingItem[]; status: ReviewStatus; terminal_reason: string | null };
export type RetryDeps = {
  claim: () => Promise<ClaimResult>;
  finish: (f: FinishInput) => Promise<{ ok: boolean; reason?: string }>;
  callModel: (system: string, user: string) => Promise<unknown | null>; // null = timeout/provider/malformed
  applyVerdicts: (items: AdviceItem[], parsed: unknown, range: { firstIndex: number; lastIndex: number; senders: string[] }) => Map<string, SemanticVerdict>;
  version: string;
};

export const runReviewRetry = async (d: RetryDeps) => {
  const c = await d.claim();
  if (!c.ok) return { ok: false as const, reason: c.reason };
  if (c.version !== d.version) {
    const f = await d.finish({ attempt: c.attempt, base_hash: c.base_hash, new_result: null, remaining: [], status: "unavailable", terminal_reason: "checker_version_changed" });
    return { ok: false as const, reason: f.ok ? "checker_version_changed" : f.reason ?? "stale" };
  }
  const items = pendingAsItems(c.pending);
  const advice = items.map((it) => ({ id: it.id, recipient: it.recipient_id, counterpart: it.counterpart_ids, ...(it.context ? { replaces_pattern: it.context } : {}), text: it.text }));
  const parsed = await d.callModel(c.evidence.system, `${c.evidence.transcript}<advice>${JSON.stringify(advice)}</advice>`);
  const verdicts = d.applyVerdicts(items, parsed, c.evidence);
  const verified: PendingItem[] = [], remaining: PendingItem[] = [];
  let rejected = 0;
  items.forEach((it, i) => {
    const s = classifyVerdict(verdicts.get(it.id));
    if (s === "verified") verified.push(c.pending[i]);
    else if (s === "rejected") rejected++;
    else remaining.push(c.pending[i]);
  });
  const exhausted = c.attempt >= c.max_attempts;
  const status: ReviewStatus = remaining.length === 0 ? "complete" : exhausted ? "unavailable" : "pending";
  const result = JSON.parse(JSON.stringify(c.result));
  restoreVerified(result, verified);
  const ai = result.advice_integrity ?? {};
  const prev: ReviewSummary = ai.review ?? { version: ADVICE_REVIEW_VERSION, status: "pending", verified: 0, rejected: 0, unresolved: c.pending.length, attempts: 0, max_attempts: c.max_attempts, can_retry: false };
  const review: ReviewSummary = {
    ...prev, status, verified: prev.verified + verified.length, rejected: prev.rejected + rejected, unresolved: remaining.length,
    attempts: c.attempt, max_attempts: c.max_attempts, can_retry: status === "pending",
    terminal_reason: status === "unavailable" ? "attempts_exhausted" : null,
  };
  result.advice_integrity = { ...ai, review, withheld_count: review.rejected + review.unresolved + (ai.deterministic_withheld ?? 0), note: customerNote(review) };
  const f = await d.finish({ attempt: c.attempt, base_hash: c.base_hash, new_result: result, remaining, status, terminal_reason: review.terminal_reason ?? null });
  if (!f.ok) return { ok: false as const, reason: f.reason ?? "stale" };
  return { ok: true as const, review, restored: verified.length, rejected, remaining: remaining.length, parsed: parsed !== null };
};
