// Single-sourced JSON extraction helpers shared by all edge functions.

export const stripFences = (s: string): string => {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  return t.trim();
};

/** Robust JSON object extraction: first balanced top-level object. */
// deno-lint-ignore no-explicit-any
export function extractJsonObject(raw: string): { value: any; cleaned: boolean } {
  const s = stripFences(raw).trim();
  try {
    return { value: JSON.parse(s), cleaned: false };
  } catch {
    /* fall through */
  }
  const start = s.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in output");
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { value: JSON.parse(s.slice(start, i + 1)), cleaned: true };
    }
  }
  throw new Error("Unbalanced JSON object in output");
}
