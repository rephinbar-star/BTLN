// Quotation integrity for Deep Read narrative sections.
//
// Runs on the model's report BEFORE temporary messages are deleted, against the
// canonical parsed messages. Pure; unit-tested in src/lib/improvement.
//
// Rules
// - A quoted segment ("..." or “...”) of at least 3 words / 12 characters in a
//   narrative field is an evidence quotation. It must appear inside ONE
//   canonical message after narrow normalisation only: whitespace collapse,
//   curly -> straight quotes/apostrophes, dash variants, the ellipsis character,
//   and letter case. No semantic or fuzzy matching.
// - A segment with an internal "..." is split; every part must come from the
//   same message in order. Parts from different messages are a stitched,
//   fabricated sentence and fail.
// - Where an object carries both a quote and a speaker, the speaker must be the
//   sender of the matching message (a line quoted INSIDE someone else's message
//   is still attributed to that message's sender).
// - Suggested replies / scripts are examples, not evidence, and are skipped.
// - An unsupported quotation removes the whole sentence that relies on it —
//   the claim is dropped, never "repaired" by stripping the quote marks.
// - Deterministic checks cannot judge paraphrase meaning; unquoted paraphrase is
//   not validated here (stated limitation, surfaced in metadata).
// - Exact duplicate narrative sentences are removed after their first
//   occurrence (the first copy, with its qualifications, stays).
//
// Metadata records counts and field paths only — never message text.

export type CanonMsg = { speaker: string; content: string };

export type QuoteIntegrityReport = {
  version: 1;
  quotes_checked: number;
  quotes_supported: number;
  sentences_removed: { path: string; reason: "not_in_source" | "stitched" | "wrong_speaker" }[];
  duplicate_sentences_removed: number;
  unsafe: boolean;
  limitation: string;
};

/** Advice / example-reply fields: quotes here are suggestions, not evidence. */
const EXAMPLE_PATH = /(communication_suggestions|scripted_alternatives|remedial_guidance\.specific_steps|\.try$|\.script|example_reply|suggested_reply|attributed_evidence|^meta|^personalization|^coverage)/;

export const normQ = (s: string) =>
  s
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const QUOTE_RE = /"([^"]{3,400})"|\u201C([^\u201C\u201D]{3,400})\u201D/g;

export const quotedIn = (text: string): string[] => {
  const out: string[] = [];
  for (const m of text.matchAll(QUOTE_RE)) {
    const q = (m[1] ?? m[2] ?? "").trim();
    if (q.length >= 12 && q.split(/\s+/).length >= 3) out.push(q);
  }
  return out;
};

const stripPunctEdge = (s: string) => s.replace(/^[\s.,;:!?'"-]+|[\s,;:!?'"-]+$/g, "").replace(/\.+$/, "").trim();

/** Returns index of the single canonical message supporting the quote, or a failure reason. */
export const locateQuote = (quote: string, msgs: CanonMsg[]): { ok: true; index: number } | { ok: false; reason: "not_in_source" | "stitched" } => {
  const parts = normQ(quote).split(/\.\.\.+/).map(stripPunctEdge).filter((p) => p.length > 0);
  if (!parts.length) return { ok: false, reason: "not_in_source" };
  const bodies = msgs.map((m) => normQ(m.content));
  for (let i = 0; i < bodies.length; i++) {
    let pos = 0;
    let ok = true;
    for (const p of parts) {
      const at = bodies[i].indexOf(p, pos);
      if (at < 0) { ok = false; break; }
      pos = at + p.length;
    }
    if (ok) return { ok: true, index: i };
  }
  if (parts.length > 1 && parts.every((p) => bodies.some((b) => b.includes(p)))) return { ok: false, reason: "stitched" };
  return { ok: false, reason: "not_in_source" };
};

const SENT_SPLIT = /(?<=[.!?])\s+(?=[A-Z\u201C"])/;

// deno-lint-ignore no-explicit-any
type Json = any;

export const enforceQuoteIntegrity = (report: Json, msgs: CanonMsg[], names: string[]): QuoteIntegrityReport => {
  const out: QuoteIntegrityReport = {
    version: 1, quotes_checked: 0, quotes_supported: 0, sentences_removed: [], duplicate_sentences_removed: 0, unsafe: false,
    limitation: "Quotes are checked verbatim against the source messages. Unquoted paraphrase cannot be verified automatically.",
  };
  const seen = new Set<string>();
  const nameSet = names.map((n) => normQ(n));

  const cleanString = (text: string, path: string, speakerHint: string | null): string => {
    const sentences = text.split(SENT_SPLIT);
    const kept: string[] = [];
    for (const s of sentences) {
      let drop: QuoteIntegrityReport["sentences_removed"][number]["reason"] | null = null;
      for (const q of quotedIn(s)) {
        out.quotes_checked++;
        const loc = locateQuote(q, msgs);
        if (!loc.ok) { drop = loc.reason; break; }
        if (speakerHint && nameSet.includes(normQ(speakerHint)) && normQ(msgs[loc.index].speaker) !== normQ(speakerHint)) { drop = "wrong_speaker"; break; }
        out.quotes_supported++;
      }
      if (drop) { out.sentences_removed.push({ path, reason: drop }); continue; }
      const key = normQ(s);
      if (key.split(" ").length >= 6 && seen.has(key)) { out.duplicate_sentences_removed++; continue; }
      if (key.split(" ").length >= 6) seen.add(key);
      kept.push(s);
    }
    return kept.join(" ").trim();
  };

  const walk = (node: Json, path: string): Json => {
    if (EXAMPLE_PATH.test(path)) return node;
    if (typeof node === "string") return cleanString(node, path, null);
    if (Array.isArray(node)) {
      const arr = node.map((v, i) => walk(v, `${path}[${i}]`));
      return arr.filter((v, i) => !(typeof node[i] === "string" && node[i].trim() && v === ""));
    }
    if (node && typeof node === "object") {
      const speaker = typeof node.speaker === "string" ? node.speaker : typeof node.who === "string" ? node.who : typeof node.person === "string" ? node.person : null;
      for (const k of Object.keys(node)) {
        const p = path ? `${path}.${k}` : k;
        if (EXAMPLE_PATH.test(p)) continue;
        const v = node[k];
        if (typeof v === "string" && speaker && /quote|example|evidence/i.test(k)) {
          // Structured quote field: the whole value may be the quotation itself.
          const bare = v.replace(/^["\u201C]|["\u201D]$/g, "");
          if (bare.split(/\s+/).length >= 3 && !quotedIn(v).length) {
            out.quotes_checked++;
            const loc = locateQuote(bare, msgs);
            const reason = !loc.ok ? loc.reason : nameSet.includes(normQ(speaker)) && normQ(msgs[loc.index].speaker) !== normQ(speaker) ? "wrong_speaker" : null;
            if (reason) { out.sentences_removed.push({ path: p, reason }); node[k] = ""; continue; }
            out.quotes_supported++;
            continue;
          }
          node[k] = cleanString(v, p, speaker);
          continue;
        }
        node[k] = walk(v, p);
      }
      return node;
    }
    return node;
  };
  walk(report, "");
  const removed = out.sentences_removed.length;
  out.unsafe = out.quotes_checked >= 4 && removed / out.quotes_checked > 0.5;
  return out;
};
