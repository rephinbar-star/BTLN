// Structured, bounded personalization contract for Deep Read advice fields.
//
// Diagnosis (2026-09-26): the previous style block appended free-text notes to
// a long system prompt, fenced as "untrusted data, not instructions", while the
// deployed schema itself demands multi-sentence steps. The model therefore had
// no field-level target and was told not to follow the note — so "one short
// sentence" was ignored.
//
// Fix: free text is never forwarded. It is mapped deterministically to a small
// enum contract; the contract names exactly which fields it applies to. An
// optional constrained rewrite edits ONLY those fields and every edit is
// validated against invariants; any failing field falls back to the original.
// Deterministic checks verify shape, not semantic correctness.

import type { CoachingPreferences } from "./coachingPreferences.ts";

export const STYLE_CONTRACT_VERSION = "style-contract-1";

export type StyleContract = {
  tone: "warm" | "direct" | null;
  concision: "one_sentence" | "brief" | null;
  emphasis: "reflective" | "action" | null;
};

export const EMPTY_CONTRACT: StyleContract = { tone: null, concision: null, emphasis: null };

export const isEmptyContract = (c: StyleContract) => !c.tone && !c.concision && !c.emphasis;

/** Map consented signals to the enum contract. Notes are matched, never forwarded. */
export const normalizeStyle = (prefs: CoachingPreferences): StyleContract => {
  if (!prefs.available) return { ...EMPTY_CONTRACT };
  const text = prefs.notes.join(" \n ").toLowerCase();
  const c: StyleContract = { ...EMPTY_CONTRACT };
  if (/\b(one|a single|1)\s+(short\s+)?sentence\b/.test(text)) c.concision = "one_sentence";
  else if (/\b(shorter|brief|concise|less text|too long)\b/.test(text)) c.concision = "brief";
  if (/\b(blunt|direct|straight)\b/.test(text)) c.tone = "direct";
  else if (/\b(gentle|gentler|warm|warmer|softer|kind)\b/.test(text)) c.tone = "warm";
  if (/\b(practical|concrete|actionable|what to do)\b/.test(text) || prefs.likedReasons.includes("actionable")) c.emphasis = "action";
  else if (/\b(reflect|reflective|understand why)\b/.test(text)) c.emphasis = "reflective";
  return c;
};

/** Paths of editable advice fields in a Deep Read result (and only these). */
export type FieldRef = { path: (string | number)[]; text: string };

export const editableFields = (result: any): FieldRef[] => {
  const out: FieldRef[] = [];
  const push = (path: (string | number)[], v: unknown) => { if (typeof v === "string" && v.trim()) out.push({ path, text: v }); };
  const cs = result?.communication_suggestions;
  for (const p of ["person1", "person2"]) (Array.isArray(cs?.[p]) ? cs[p] : []).forEach((v: unknown, i: number) => push(["communication_suggestions", p, i], v));
  const rg = result?.remedial_guidance;
  (Array.isArray(rg?.specific_steps) ? rg.specific_steps : []).forEach((v: unknown, i: number) => push(["remedial_guidance", "specific_steps", i], v));
  (Array.isArray(rg?.scripted_alternatives) ? rg.scripted_alternatives : []).forEach((v: any, i: number) => push(["remedial_guidance", "scripted_alternatives", i, "try"], v?.try));
  return out;
};

export const pathKey = (p: (string | number)[]) => p.join(".");

export const setAt = (obj: any, path: (string | number)[], value: string) => {
  let o = obj;
  for (let i = 0; i < path.length - 1; i++) o = o?.[path[i]];
  if (o && typeof o === "object") o[path[path.length - 1]] = value;
};

const HEDGE = /\b(may|might|could|perhaps|possibly|seems?|appears?|if|unclear|maybe|consider)\b/i;
export const sentenceCount = (s: string) => s.trim().split(/(?<=[.!?])\s+(?=[A-Z"'“])/).filter((x) => x.trim()).length;
export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const quotes = (s: string) => [...s.matchAll(/["“]([^"”]{3,})["”]/g)].map((m) => m[1].trim().toLowerCase());
const names = (s: string) => new Set([...s.matchAll(/(?<![.!?]\s|^)\b([A-Z][a-z]{2,})\b/g)].map((m) => m[1]));

export type FieldCheck = { key: string; ok: boolean; reasons: string[] };

/** Validate one rewritten field against invariants and the contract's targets. */
export const checkField = (original: string, rewritten: unknown, contract: StyleContract, allowedNames: string[]): FieldCheck & { key: "" } => {
  const reasons: string[] = [];
  if (typeof rewritten !== "string" || !rewritten.trim()) return { key: "", ok: false, reasons: ["empty_or_not_text"] };
  const r = rewritten.trim();
  if (contract.concision === "one_sentence" && sentenceCount(r) !== 1) reasons.push("not_one_sentence");
  const maxWords = contract.concision === "one_sentence" ? 30 : contract.concision === "brief" ? Math.max(12, Math.ceil(wordCount(original) * 0.8)) : Math.ceil(wordCount(original) * 1.3) + 5;
  if (wordCount(r) > maxWords) reasons.push("over_length_bound");
  if (wordCount(r) < 3) reasons.push("too_short_to_be_useful");
  if (HEDGE.test(original) && !HEDGE.test(r)) reasons.push("uncertainty_dropped");
  const origQuotes = new Set(quotes(original));
  if (quotes(r).some((q) => !origQuotes.has(q))) reasons.push("new_quote");
  const allowed = new Set([...allowedNames, ...names(original)]);
  const added = [...names(r)].filter((n) => !allowed.has(n));
  if (added.length) reasons.push(`new_name:${added.join(",")}`);
  return { key: "", ok: reasons.length === 0, reasons };
};

export const contractInstruction = (c: StyleContract): string => {
  if (isEmptyContract(c)) return "";
  const lines = ["PERSONAL PRESENTATION PREFERENCES (structured, applies only to advice wording):"];
  if (c.concision === "one_sentence") lines.push("- Write each item of communication_suggestions, remedial_guidance.specific_steps and each scripted_alternatives[].try as exactly one short sentence.");
  if (c.concision === "brief") lines.push("- Keep each advice item brief.");
  if (c.tone) lines.push(`- Tone of advice: ${c.tone}.`);
  if (c.emphasis) lines.push(`- Emphasis of advice: ${c.emphasis === "action" ? "concrete next actions" : "reflection on the dynamic"}.`);
  lines.push("- Do not change evidence, scores, attribution, uncertainty or any other section. Keep every required section. Never agree with a claim the messages do not support.");
  return lines.join("\n");
};

export type ApplyReport = {
  version: string;
  contract: StyleContract;
  fields_total: number;
  fields_applied: number;
  fields_fallback: { key: string; reasons: string[] }[];
  rewrite: "not_needed" | "done" | "failed";
};

/** Apply validated rewrites to a copy; each failing field keeps its original text. */
export const applyRewrites = (result: any, rewrites: Record<string, unknown>, contract: StyleContract, allowedNames: string[]) => {
  const fields = editableFields(result);
  const report: ApplyReport = { version: STYLE_CONTRACT_VERSION, contract, fields_total: fields.length, fields_applied: 0, fields_fallback: [], rewrite: "done" };
  for (const f of fields) {
    const key = pathKey(f.path);
    const chk = checkField(f.text, rewrites[key], contract, allowedNames);
    if (chk.ok) { setAt(result, f.path, String(rewrites[key]).trim()); report.fields_applied++; }
    else report.fields_fallback.push({ key, reasons: chk.reasons });
  }
  return report;
};

/** Fields that already meet the contract (so no rewrite is needed for them). */
export const fieldsNeedingRewrite = (result: any, contract: StyleContract, allowedNames: string[]) =>
  editableFields(result).filter((f) => !checkField(f.text, f.text, contract, allowedNames).ok);
