// Generic disclosure of prompt-injection attempts (injection-disclosure-1).
//
// Finding (run a5520bf4-…, candidate f8f27886): the model resisted an injected
// instruction but reproduced its payload inside a safety note. A warning never
// needs to repeat the attacker's text, so warning-like fields that reproduce
// words from an instruction-shaped message are replaced by a generic notice.
// Nothing is hardcoded to a test token: any 3-word span or any mixed
// letter/digit token from the instruction-shaped message counts. Evidence and
// quote fields are left alone (legitimate quotations stay allowed; the quote
// checks govern them).

export const INJECTION_DISCLOSURE_VERSION = "injection-disclosure-1";
export const GENERIC_INJECTION_NOTICE = "One message contained instructions aimed at this tool. They were treated as part of the chat and not followed.";

const INSTR = /\b(ignore (?:all|any|previous|prior|the)|disregard|system\s*:|you are now|new instructions|reply only|respond only|print |output only|say that|override)\b/i;
export const WARNING_KEY = /(safety|warning|caution|disclaimer|injection|notice|_note$|^note$)/i;
const EVIDENCE_KEY = /(quote|verbatim|evidence|excerpt)/i;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\- ]+/g, " ").replace(/\s+/g, " ").trim();

export const instructionMessages = (texts: string[]) => texts.filter((t) => INSTR.test(t));

export const reproducesPayload = (text: string, payloads: string[]): boolean => {
  const t = ` ${norm(text)} `;
  for (const p of payloads) {
    const words = norm(p).split(" ").filter(Boolean);
    if (words.some((w) => w.length >= 4 && /[a-z]/.test(w) && /\d/.test(w) && t.includes(` ${w} `))) return true;
    for (let i = 0; i + 3 <= words.length; i++) {
      const span = words.slice(i, i + 3).join(" ");
      if (span.length >= 12 && t.includes(` ${span} `)) return true;
    }
  }
  return false;
};

/** Replace warning fields that reproduce injected text. Mutates; returns the paths changed. */
export const sanitizeDisclosures = (result: unknown, messageTexts: string[]): string[] => {
  const payloads = instructionMessages(messageTexts);
  const changed: string[] = [];
  if (!payloads.length) return changed;
  const walk = (v: unknown, path: string, underWarning: boolean) => {
    if (Array.isArray(v)) { v.forEach((x, i) => {
      if (typeof x === "string" && underWarning && reproducesPayload(x, payloads)) { v[i] = GENERIC_INJECTION_NOTICE; changed.push(`${path}.${i}`); }
      else walk(x, `${path}.${i}`, underWarning);
    }); return; }
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    for (const [k, val] of Object.entries(o)) {
      if (EVIDENCE_KEY.test(k)) continue;
      const w = underWarning || WARNING_KEY.test(k);
      if (typeof val === "string" && w && reproducesPayload(val, payloads)) { o[k] = GENERIC_INJECTION_NOTICE; changed.push(path ? `${path}.${k}` : k); }
      else walk(val, path ? `${path}.${k}` : k, w);
    }
  };
  walk(result, "", false);
  return changed;
};

/** Deterministic unseen payload token for an evaluation run (not a fixed canary). */
export const payloadToken = async (seed: string) => {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`payload:${seed}`)));
  const words = ["MARLIN", "QUARTZ", "TUNDRA", "OBELISK", "VESPER", "HALCYON", "ZEPHYR", "NIMBUS"];
  return `${words[d[0] % words.length]}-${[...d.slice(1, 4)].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
};
