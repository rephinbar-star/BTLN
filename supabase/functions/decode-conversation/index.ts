import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  callOpenRouter,
  extractMessages,
} from "../_shared/extractMessages.ts";
import { extractJsonObject } from "../_shared/extractJson.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_SCREENSHOTS = 10;

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const OPENROUTER_HTTP_REFERER =
    Deno.env.get("OPENROUTER_HTTP_REFERER") ?? "https://betweenthelines.app";
  const OPENROUTER_X_TITLE = Deno.env.get("OPENROUTER_X_TITLE") ?? "BetweenTheLines";
  if (!OPENROUTER_API_KEY) {
    return json(500, { error: "OPENROUTER_API_KEY is not configured" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const decode_id: string | undefined = payload?.decode_id;
  const session_id: string | undefined = payload?.session_id;
  const source: string | undefined = payload?.source;
  const input = payload?.input ?? {};
  const raw_text: string | undefined = input?.raw_text ?? payload?.raw_text;
  const screenshot_base64_array: string[] | undefined =
    input?.screenshot_base64_array ?? payload?.screenshot_base64_array;
  const name1: string = input?.name1 ?? "You";
  const name2: string = input?.name2 ?? "Them";

  if (!session_id) return json(400, { error: "Missing session_id" });
  const hasImages = !!screenshot_base64_array?.length;
  if (!raw_text?.trim() && !hasImages) {
    return json(400, { error: "input must include raw_text or screenshot_base64_array" });
  }

  let row_id: string;
  if (decode_id) {
    const { data: existing } = await supabase
      .from("decodes")
      .select("id, session_id")
      .eq("id", decode_id)
      .maybeSingle();
    if (!existing) return json(404, { error: "Decode not found" });
    if (existing.session_id !== session_id) {
      return json(403, { error: "Not authorized for this decode" });
    }
    row_id = existing.id as string;
    await supabase
      .from("decodes")
      .update({ status: "pending", error_message: null, source: source ?? null })
      .eq("id", row_id);
  } else {
    const { data: created, error: createErr } = await supabase
      .from("decodes")
      .insert({ session_id, source: source ?? null, status: "pending" })
      .select("id")
      .single();
    if (createErr || !created) {
      return json(500, { error: `Could not create decode: ${createErr?.message}` });
    }
    row_id = created.id as string;
  }

  const fail = async (msg: string) => {
    await supabase
      .from("decodes")
      .update({ status: "failed", error_message: msg })
      .eq("id", row_id);
  };

  const run = async (): Promise<void> => {
    const { data: pv, error: pvErr } = await supabase
      .from("prompt_versions")
      .select("id, prompt_text, model_string, vision_model_string")
      .eq("active", true)
      .eq("kind", "decode")
      .maybeSingle();
    if (pvErr || !pv) return fail("No active decode prompt configured.");

    await supabase.from("decodes").update({ status: "extracting" }).eq("id", row_id);

    const extracted = await extractMessages({
      input_method: hasImages ? "screenshot" : "paste",
      name1,
      name2,
      raw_text,
      imageUrls: screenshot_base64_array?.slice(0, MAX_SCREENSHOTS),
      model_string: pv.model_string,
      vision_model_string: pv.vision_model_string,
      apiKey: OPENROUTER_API_KEY,
      referer: OPENROUTER_HTTP_REFERER,
      title: OPENROUTER_X_TITLE,
    });
    if ("error" in extracted) return fail(extracted.error);

    const messages = extracted.messages
      .filter((m) => m && m.content && (m.sender_role === "user" || m.sender_role === "partner"))
      .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
    if (messages.length === 0) return fail("No messages could be extracted from the input.");

    const exchange = messages
      .map((m) =>
        `${m.sender_role === "user" ? `${name1} (the user)` : `${name2} (the other person)`}: ${m.content}`
      )
      .join("\n");

    await supabase.from("decodes").update({ status: "analyzing" }).eq("id", row_id);

    const r = await callOpenRouter(
      {
        model: pv.model_string,
        messages: [
          { role: "system", content: pv.prompt_text },
          { role: "user", content: exchange },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      },
      OPENROUTER_API_KEY,
      OPENROUTER_HTTP_REFERER,
      OPENROUTER_X_TITLE,
    );
    if (!r.ok) return fail(`Decode failed: ${r.status} ${r.errorText}`);

    let result: any;
    try {
      result = extractJsonObject(String(r.data?.choices?.[0]?.message?.content ?? "")).value;
    } catch (e) {
      return fail(`Decode response was not valid JSON: ${e instanceof Error ? e.message : e}`);
    }

    const { error: updErr } = await supabase
      .from("decodes")
      .update({ result_json: result, status: "complete", error_message: null })
      .eq("id", row_id);
    if (updErr) return fail(`Could not save decode: ${updErr.message}`);
  };

  const pipeline = async () => {
    try {
      await run();
    } catch (e) {
      await fail(e instanceof Error ? e.message : "Unexpected decode error.");
    }
  };

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(pipeline());
  } else {
    void pipeline();
  }

  return json(202, { decode_id: row_id, status: "accepted" });
});
