// Advice recipient integrity for Deep Read (advice-recipient-1).
//
// Causal finding (2026-09-26, run ec8ce5d8-…): the report's participants are
// p1 = Taylor (name1, the reader) and p2 = Alex. communication_suggestions were
// correctly addressed. The defect was in remedial_guidance: the schema says
// specific_steps / scripted_alternatives[].try are "addressed to user" (p1),
// but it lets instead_of carry the OTHER person's quoted pattern, and the style
// rewrite received bare positional keys with no recipient at all. Step 0 told
// Taylor to stop saying "never" — a word only Alex used. The pre-rewrite text
// was not persisted, so whether generation or rewrite introduced that exact
// step cannot be proven from records; scripted_alternatives[0] shows the
// schema itself produced a mixed recipient in the original generation.
//
// Fix: every advice item carries a stable id, an immutable recipient id and
// counterpart ids. Items are checked against canonical messages (who actually
// said a phrase the advice asks the recipient to change) before and after any
// rewrite. Merges are by id. Failing originals are withheld with a reason, never
// shown silently. Deterministic checks catch ownership of quoted behaviour and
// misaddressing; they do not prove full semantic correctness.

export const ADVICE_RECIPIENT_VERSION = "advice-recipient-1";

export type Participant = { id: string; label: string; role: "user" | "partner" };
export type AdviceItem = {
  id: string;
  path: (string | number)[];
  recipient_id: string;
  counterpart_ids: string[];
  kind: "suggestion" | "step" | "script";
  text: string;
  context?: string; // e.g. scripted_alternatives[].instead_of (immutable)
};
export type Msg = { sender_role: "user" | "partner"; content: string };

const norm = (s: string) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, " ").trim();

export const adviceItems = (result: any, parts: Participant[]): AdviceItem[] => {
  const p1 = parts.find((p) => p.role === "user")!;
  const p2 = parts.find((p) => p.role === "partner")!;
  const out: AdviceItem[] = [];
  const cs = result?.communication_suggestions;
  ([["person1", p1, p2], ["person2", p2, p1]] as const).forEach(([k, me, other]) =>
    (Array.isArray(cs?.[k]) ? cs[k] : []).forEach((t: unknown, i: number) => {
      if (typeof t === "string" && t.trim()) out.push({ id: `cs.${me.id}.${i}`, path: ["communication_suggestions", k, i], recipient_id: me.id, counterpart_ids: [other.id], kind: "suggestion", text: t });
    }));
  const rg = result?.remedial_guidance;
  // Schema: specific_steps and scripted "try" are addressed to the reader (p1).
  (Array.isArray(rg?.specific_steps) ? rg.specific_steps : []).forEach((t: unknown, i: number) => {
    if (typeof t === "string" && t.trim()) out.push({ id: `step.${i}`, path: ["remedial_guidance", "specific_steps", i], recipient_id: p1.id, counterpart_ids: [p2.id], kind: "step", text: t });
  });
  (Array.isArray(rg?.scripted_alternatives) ? rg.scripted_alternatives : []).forEach((s: any, i: number) => {
    if (typeof s?.try === "string" && s.try.trim()) out.push({ id: `script.${i}`, path: ["remedial_guidance", "scripted_alternatives", i, "try"], recipient_id: p1.id, counterpart_ids: [p2.id], kind: "script", text: s.try, context: typeof s.instead_of === "string" ? s.instead_of : undefined });
  });
  return out;
};

// Apostrophes inside words ("Alex's") are not quote marks.
const OPEN = `(?:"|\u201C|(?<![A-Za-z])'|(?<![A-Za-z])\u2018)`;
const CLOSE = `(?:"|\u201D|'(?![A-Za-z])|\u2019(?![A-Za-z]))`;
const QUOTED = new RegExp(`${OPEN}([^"\u201C\u201D]{2,80}?)${CLOSE}`, "g");
// Phrases the advice asks the RECIPIENT to stop/replace: they must be the recipient's own words.
const CHANGE = new RegExp(`\\b(instead of|rather than|replace|replacing|stop (?:saying|using|writing)|avoid (?:saying|using)|swap|drop)\\b[^.]*?${OPEN}([^"\u201C\u201D]{2,80}?)${CLOSE}`, "gi");

const saidBy = (phrase: string, msgs: Msg[], role: "user" | "partner") => {
  const p = norm(phrase).replace(/[.,!?]+$/, "");
  if (p.length < 2) return false;
  const re = new RegExp(`(^|[^a-z])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
  return msgs.some((m) => m.sender_role === role && re.test(norm(m.content)));
};

export type RecipientCheck = { ok: boolean; reasons: string[] };

export const checkRecipient = (item: AdviceItem, text: string, parts: Participant[], msgs: Msg[]): RecipientCheck => {
  const reasons: string[] = [];
  const me = parts.find((p) => p.id === item.recipient_id)!;
  const others = parts.filter((p) => item.counterpart_ids.includes(p.id));
  const sameNames = others.some((o) => norm(o.label) === norm(me.label));
  const unquoted = text.replace(QUOTED, " ");
  if (!sameNames) {
    // Vocative to the counterpart ("Alex, try …") means the advice is addressed to the wrong person.
    if (others.some((o) => new RegExp(`^\\s*${o.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*,`, "i").test(unquoted))) reasons.push("addresses_counterpart");
    // The recipient named as a third party outside quotes ("…ask Taylor…" in advice for Taylor).
    if (new RegExp(`\\b${me.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(unquoted)) reasons.push("recipient_named_as_third_party");
  }
  for (const m of text.matchAll(CHANGE)) {
    const phrase = m[2];
    const mine = saidBy(phrase, msgs, me.role);
    const theirs = others.some((o) => saidBy(phrase, msgs, o.role));
    if (!mine && theirs) reasons.push(`behavior_owner_mismatch:${norm(phrase).slice(0, 40)}`);
  }
  if (item.kind === "script" && item.context) {
    // The pattern being replaced must be the recipient's own quoted words.
    for (const m of item.context.matchAll(QUOTED)) {
      const mine = saidBy(m[1], msgs, me.role);
      const theirs = others.some((o) => saidBy(m[1], msgs, o.role));
      if (!mine && theirs) { reasons.push(`script_pattern_belongs_to_counterpart`); break; }
    }
  }
  return { ok: reasons.length === 0, reasons };
};

export type AdviceStatus = { id: string; recipient_id: string; status: "kept" | "rewritten" | "withheld"; reasons: string[] };

/** Withhold originals that fail the recipient check. Mutates result; returns statuses. */
export const withholdMisattributed = (result: any, parts: Participant[], msgs: Msg[]): { items: AdviceItem[]; statuses: AdviceStatus[] } => {
  const items = adviceItems(result, parts);
  const statuses: AdviceStatus[] = [];
  const bad = new Set<string>();
  const kept: AdviceItem[] = [];
  for (const it of items) {
    const c = checkRecipient(it, it.text, parts, msgs);
    if (c.ok) { kept.push(it); statuses.push({ id: it.id, recipient_id: it.recipient_id, status: "kept", reasons: [] }); }
    else { bad.add(it.id); statuses.push({ id: it.id, recipient_id: it.recipient_id, status: "withheld", reasons: c.reasons }); }
  }
  if (bad.size) {
    const cs = result.communication_suggestions;
    for (const k of ["person1", "person2"]) if (Array.isArray(cs?.[k])) {
      const rid = k === "person1" ? parts.find((p) => p.role === "user")!.id : parts.find((p) => p.role === "partner")!.id;
      cs[k] = cs[k].filter((_: unknown, i: number) => !bad.has(`cs.${rid}.${i}`));
    }
    const rg = result.remedial_guidance;
    if (Array.isArray(rg?.specific_steps)) rg.specific_steps = rg.specific_steps.filter((_: unknown, i: number) => !bad.has(`step.${i}`));
    if (Array.isArray(rg?.scripted_alternatives)) rg.scripted_alternatives = rg.scripted_alternatives.filter((_: unknown, i: number) => !bad.has(`script.${i}`));
  }
  // Re-derive ids/paths for the surviving items so later merges stay aligned.
  return { items: bad.size ? adviceItems(result, parts) : kept, statuses };
};

/** Rewrite request with explicit recipient vs counterpart per item; keyed by id. */
export const rewritePayload = (items: AdviceItem[], parts: Participant[]) =>
  items.map((it) => {
    const me = parts.find((p) => p.id === it.recipient_id)!;
    return {
      id: it.id,
      recipient: `${me.label} [${me.id}] — the person this advice is for; address them only as "you"`,
      counterpart: it.counterpart_ids.map((c) => { const o = parts.find((p) => p.id === c)!; return `${o.label} [${o.id}] — refer to them by name, never as "you"`; }).join("; "),
      ...(it.context ? { replaces_pattern: it.context } : {}),
      text: it.text,
    };
  });

/** Merge rewritten texts by id only; unknown ids, duplicates and non-strings are ignored. */
export const mergeById = (items: AdviceItem[], response: unknown): Map<string, string> => {
  const out = new Map<string, string>();
  const known = new Set(items.map((i) => i.id));
  const rows: [string, unknown][] = Array.isArray((response as any)?.items)
    ? (response as any).items.map((r: any) => [String(r?.id ?? ""), r?.text])
    : Object.entries((response ?? {}) as Record<string, unknown>);
  for (const [id, t] of rows) if (known.has(id) && !out.has(id) && typeof t === "string") out.set(id, t);
  return out;
};
