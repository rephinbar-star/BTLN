// Relationship360 compact synthesis context (r360-context-1).
//
// Cost finding (2026-09-26): the whole-account request for synthetic account A
// (85 observations, 9 sources, 4 relationships) was refused before any spend.
// Each observation was sent as a JSON object repeating three UUIDs, the
// relationship label, source kind and eleven key names (~450 characters of
// framing around a ~135-character statement). At the conservative bound
// (gpt-6-astra $20/M in, $100/M out; ~3 chars/token) that is ~18.5k input
// tokens ($0.37) + the 2,600-token output bound ($0.26) = ~$0.63 > $0.60.
//
// Fix: sources and relationships are sent once as legends; observations use
// short references (O1, S1, R1) mapped back to canonical ids server-side before
// validation. Every statement, actor, kind, type, date and confidence is kept.
// If the estimate still exceeds the call budget, observations are reduced by
// the existing representative selection and the omission is reported in
// coverage — never silently.

type Obs = { id: string; journey_source_id: string; subject_kind: string; subject_label: string | null; observation_type: string; statement: string; confidence: string | null; observed_period_start: string | null; observed_period_end: string | null };
type Src = { id: string; source_kind: string; relationship_id: string; observed_period_start?: string | null; observed_period_end?: string | null; dated_count?: number | null };
type Rel = { id: string; label: string | null; is_confirmed: boolean };

export const R360_CONTEXT_VERSION = "r360-context-1";

export const compactContext = (observations: Obs[], sources: Map<string, Src>, rels: Map<string, Rel>) => {
  const sId = new Map<string, string>(), rId = new Map<string, string>(), oId = new Map<string, string>();
  const back = new Map<string, string>();
  const short = (m: Map<string, string>, p: string, id: string) => { if (!m.has(id)) { const s = `${p}${m.size + 1}`; m.set(id, s); if (p === "O") back.set(s, id); } return m.get(id)!; };
  const rows = observations.map((o) => {
    const src = sources.get(o.journey_source_id);
    const S = short(sId, "S", o.journey_source_id);
    if (src) short(rId, "R", src.relationship_id);
    const d = o.observed_period_start ? `${o.observed_period_start.slice(0, 10)}${o.observed_period_end && o.observed_period_end.slice(0, 10) !== o.observed_period_start.slice(0, 10) ? `..${o.observed_period_end.slice(0, 10)}` : ""}` : "undated";
    return `${short(oId, "O", o.id)}|${S}|${o.subject_kind}|${o.subject_label ?? ""}|${o.observation_type}|${d}|${o.confidence ?? ""}|${o.statement.replace(/\s+/g, " ")}`;
  });
  const srcLegend = [...sId.entries()].map(([id, S]) => { const s = sources.get(id); return `${S}|${s?.source_kind ?? "unknown"}|${s ? rId.get(s.relationship_id) : ""}|${s?.observed_period_start?.slice(0, 10) ?? "?"}..${s?.observed_period_end?.slice(0, 10) ?? "?"}`; });
  const relLegend = [...rId.entries()].map(([id, R]) => { const r = rels.get(id); return `${R}|${(r?.label ?? "A relationship").replace(/\|/g, "/")}|${r?.is_confirmed ? "confirmed" : "unconfirmed"}`; });
  const text = `Format: pipe-separated rows. Use the O-ids exactly as written wherever the schema asks for observation_id.
<relationships>R|label|status
${relLegend.join("\n")}
</relationships>
<sources>S|kind|relationship|verified_period
${srcLegend.join("\n")}
</sources>
<observations>O|source|about|actor|type|observed|confidence|statement
${rows.join("\n")}
</observations>`;
  return { text, back };
};

/** Replace short observation refs with canonical ids inside evidence arrays. Unknown refs are dropped later by validation. */
export const expandRefs = (v: unknown, back: Map<string, string>): unknown => {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" && back.has(x.trim()) ? back.get(x.trim())! : expandRefs(x, back)));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, expandRefs(x, back)]));
  return v;
};
