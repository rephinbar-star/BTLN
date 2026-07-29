import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assignCoupleType } from "../_shared/assignCoupleType.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const stripFences = (s: string): string => {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  return t.trim();
};

function extractJsonObject(raw: string): { value: any; cleaned: boolean } {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { adminPassword, model, conversation, context } = body ?? {};

    const expected = Deno.env.get("ADMIN_PASSWORD") ?? "";
    if (!expected) return json({ ok: false, error: "ADMIN_PASSWORD not configured" }, 500);
    if (typeof adminPassword !== "string" || adminPassword !== expected) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    if (typeof model !== "string" || !model.trim()) {
      return json({ ok: false, error: "model is required" }, 400);
    }
    if (typeof conversation !== "string" || !conversation.trim()) {
      return json({ ok: false, model, error: "conversation is required" }, 400);
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return json({ ok: false, model, error: "OPENROUTER_API_KEY is not configured" }, 500);
    }
    const referer =
      Deno.env.get("OPENROUTER_HTTP_REFERER") ?? "https://betweenthelines.app";
    const title = Deno.env.get("OPENROUTER_X_TITLE") ?? "BetweenTheLines";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: pv, error: pvErr } = await supabase
      .from("prompt_versions")
      .select("prompt_text, model_string")
      .eq("active", true)
      .maybeSingle();
    if (pvErr || !pv) {
      return json({ ok: false, model, error: "No active prompt version configured." }, 500);
    }

    const ctx = (context ?? {}) as Record<string, string | undefined>;
    const userBlock = `CONTEXT:
- Names: ${ctx.name1 ?? ""} and ${ctx.name2 ?? ""}
- Relationship type: ${ctx.relationship_type ?? "romantic"}
- Relationship stage: ${ctx.relationship_stage ?? ""}
- Duration: ${ctx.duration ?? ""}
- Goal for analysis: ${ctx.goal ?? ""}
- Free-text: ${ctx.free_text ?? ""}

MESSAGES:
${conversation}`;

    const isBaseline = model === pv.model_string;
    const started = Date.now();

    let res: Response;
    try {
      res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": referer,
          "X-Title": title,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: pv.prompt_text },
            { role: "user", content: userBlock },
          ],
          response_format: { type: "json_object" },
          temperature: 0.4,
          usage: { include: true },
        }),
      });
    } catch (err) {
      return json({
        ok: false,
        model,
        isBaseline,
        ms: Date.now() - started,
        error: `Request failed: ${(err as Error).message}`,
      });
    }

    const ms = Date.now() - started;

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      return json({
        ok: false,
        model,
        isBaseline,
        ms,
        error: `OpenRouter ${res.status}: ${errorText.slice(0, 2000)}`,
      });
    }

    const data = await res.json().catch(() => null);
    const content = String(data?.choices?.[0]?.message?.content ?? "");
    const usage = data?.usage ?? null;

    let parsed: unknown = null;
    let jsonError: string | null = null;
    let coupleTypeId: number | null = null;
    let parseCleaned = false;
    try {
      const extracted = extractJsonObject(content);
      parsed = extracted.value;
      parseCleaned = extracted.cleaned;
      coupleTypeId = assignCoupleType(parsed, ctx.relationship_type ?? "romantic");
    } catch (err) {
      jsonError = (err as Error).message;
    }

    return json({
      ok: true,
      model,
      isBaseline,
      ms,
      usage,
      content,
      parsed,
      jsonError,
      parse_cleaned: parseCleaned,
      couple_type_id: coupleTypeId,
    });
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});