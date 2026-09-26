// Group Read concision (group-brevity-1).
//
// Diagnosis of 9da8d061 (run 406000af, 3,000 messages, 4 people): 901 words
// against a flat 900 limit. The length came from (a) every section note
// running 2-3 sentences, (b) role-card "why" paragraphs restating the same
// quote already shown as that card's evidence, and (c) the same moment
// (#2997 "Ben what are you on about") retold in repair, role cards and
// subgroups. Nothing was wrong with coverage; ideas were repeated.
//
// Fix: a generation-level contract with per-field bounds that scale with group
// size, one home per idea, and no repetition of a card's evidence quote in its
// explanation. Output is never truncated after generation; participants are
// never dropped to save words.

export const GROUP_BREVITY_VERSION = "group-brevity-1";

export const groupBounds = (participants: number) => {
  const n = Math.max(2, Math.min(participants, 20));
  return { headline: 16, why: 40, note: 45, total: Math.min(900, 220 + 130 * n) };
};

export const groupBrevityContract = (participants: number) => {
  const b = groupBounds(participants);
  return `LENGTH AND FOCUS (${GROUP_BREVITY_VERSION}; ${participants} participants):
- Keep every participant. Brevity never removes a person, a supported insight, a safety note or uncertainty.
- Each role-card headline: at most ${b.headline} words. Each role-card "why": at most ${b.why} words, and do not repeat that card's evidence quote in it.
- Each section note (balance, repair, initiation, unanswered, subgroups, etc.): one or two sentences, at most ${b.note} words.
- Give each moment or quote ONE home. If a moment is already used as evidence elsewhere, refer to it briefly ("the #2997 call-out") rather than retelling it.
- Whole report prose: about ${b.total} words or fewer. Prefer one precise sentence over two general ones.`;
};

const SKIP = new Set(["coverage", "stats", "stats_json", "meta", "participant_id", "confidence", "flag", "available", "safety_mode", "role", "id"]);
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Prose strings with their dotted path, excluding coverage/stat metadata and enum fields. */
export const proseFields = (o: unknown, path = ""): { path: string; text: string }[] => {
  if (typeof o === "string") return o.trim() ? [{ path, text: o }] : [];
  if (Array.isArray(o)) return o.flatMap((x, i) => proseFields(x, `${path}[${i}]`));
  if (o && typeof o === "object") return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (SKIP.has(k) ? [] : proseFields(v, path ? `${path}.${k}` : k)));
  return [];
};

const QUOTE = /["\u201C'\u2018]([^"\u201C\u201D'\u2019]{8,120})["\u201D'\u2019]/g;
const nq = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export const checkGroupBrevity = (o: any, participants: number) => {
  const b = groupBounds(participants);
  const fields = proseFields(o);
  const total = fields.reduce((n, f) => n + words(f.text), 0);
  const over: string[] = [];
  for (const f of fields) {
    const w = words(f.text);
    const leaf = f.path.split(".").pop() ?? "";
    const lim = leaf === "headline" ? b.headline : leaf === "why" ? b.why : leaf === "note" ? b.note : null;
    if (lim !== null && w > lim) over.push(`${f.path} ${w}/${lim}`);
  }
  // One home per idea: a quoted moment appearing in 2+ different top-level sections.
  const homes = new Map<string, Set<string>>();
  for (const f of fields) {
    const top = f.path.split(/[.[]/)[0];
    for (const m of f.text.matchAll(QUOTE)) {
      const q = nq(m[1]);
      if (q.split(" ").length < 2) continue;
      (homes.get(q) ?? homes.set(q, new Set()).get(q)!).add(top);
    }
  }
  const duplicated = [...homes.entries()].filter(([, s]) => s.size > 1).map(([q]) => q);
  // A card that repeats its own evidence quote inside "why".
  const selfRepeat = (Array.isArray(o?.role_cards) ? o.role_cards : []).filter((c: any) => typeof c?.evidence === "string" && c.evidence.length >= 8 && typeof c?.why === "string" && nq(c.why).includes(nq(c.evidence))).length;
  const ids = new Set((Array.isArray(o?.role_cards) ? o.role_cards : []).map((c: any) => String(c?.participant_id ?? "")));
  return { limit: b.total, total, over, duplicated, selfRepeat, participantsCovered: ids.size };
};
