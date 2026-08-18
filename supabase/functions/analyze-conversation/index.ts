import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assignCoupleType } from "../_shared/assignCoupleType.ts";
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

const MAX_OUTPUT_TOKENS = 8000;
const MAX_SCREENSHOTS = 30;
const MAX_MESSAGES = 100;

type ContextData = {
  name1: string;
  name2: string;
  relationship_type?: "romantic" | "friend" | "family";
  relationship_stage?: string;
  duration?: string;
  goal?: string;
  free_text?: string;
};

const TS_RE = /^\[?\s*\d{1,2}[\/\-.]\d{1,2}|^\d{1,2}:\d{2}/;
const truncateConversation = (text: string, max: number): string => {
  const lines = text.split(/\r?\n/);
  const nonEmpty: number[] = [];
  lines.forEach((line, index) => {
    if (line.trim().length > 0) nonEmpty.push(index);
  });
  const dated = nonEmpty.filter((index) => TS_RE.test(lines[index]));
  const markers = dated.length >= 5 ? dated : nonEmpty;
  if (markers.length <= max) return text;
  return lines.slice(0, markers[max]).join("\n").trimEnd();
};

// EdgeRuntime is provided by the Supabase Edge runtime but isn't in the
// Deno type defs we have here.
// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const OPENROUTER_HTTP_REFERER =
    Deno.env.get("OPENROUTER_HTTP_REFERER") ??
    "https://betweenthelines.app";
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

  const session_id: string | undefined = payload?.session_id;
  const context_data: ContextData | undefined = payload?.context_data;
  const input_method: "paste" | "chat_file" | "screenshot" | undefined =
    payload?.input_method;
  const raw_text: string | undefined = payload?.raw_text;
  const screenshot_base64_array: string[] | undefined =
    payload?.screenshot_base64_array;
  const screenshot_storage_paths: string[] | undefined =
    payload?.screenshot_storage_paths;
  const provided_analysis_id: string | undefined = payload?.analysis_id;

  if (!session_id || !context_data || !input_method) {
    return json(400, { error: "Missing session_id, context_data, or input_method" });
  }
  if (!context_data.name1 || !context_data.name2) {
    return json(400, { error: "context_data.name1 and name2 are required" });
  }
  if (
    (input_method === "paste" || input_method === "chat_file") &&
    !raw_text?.trim()
  ) {
    return json(400, { error: "raw_text is required for paste/chat_file" });
  }
  if (
    input_method === "screenshot" &&
    (!screenshot_storage_paths || screenshot_storage_paths.length === 0) &&
    (!screenshot_base64_array || screenshot_base64_array.length === 0)
  ) {
    return json(400, { error: "screenshot_storage_paths or screenshot_base64_array is required for screenshot" });
  }

  const raw_text_for_analysis = raw_text
    ? truncateConversation(raw_text, MAX_MESSAGES)
    : raw_text;
  const screenshot_paths_for_analysis = screenshot_storage_paths?.slice(0, MAX_SCREENSHOTS);
  const screenshot_base64_for_analysis = screenshot_base64_array?.slice(0, MAX_SCREENSHOTS);

  // 1. Resolve analysis row: update existing if analysis_id provided, else create one.
  let analysis_id: string;
  if (provided_analysis_id) {
    const { data: existing, error: exErr } = await supabase
      .from("analyses")
      .select("id, session_id, user_id")
      .eq("id", provided_analysis_id)
      .maybeSingle();
    if (exErr || !existing) {
      return json(404, { error: `Analysis row ${provided_analysis_id} not found` });
    }
    // Ownership check: caller must either own the row (matching JWT user_id)
    // or present the original session_id. Analysis UUIDs are shareable via
    // /report/:id, so existence alone is not authorization.
    let jwt_user_id: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      // supabase-js v2.45 in the Edge runtime does not expose getClaims().
      // Validate the caller token with getUser() instead; anonymous/anon-key
      // callers can still re-run only when their browser session_id matches.
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (!userErr) {
        jwt_user_id = userData?.user?.id ?? null;
      }
    }
    const ownsByUser =
      jwt_user_id !== null && existing.user_id === jwt_user_id;
    const ownsBySession =
      !!session_id && existing.session_id === session_id;
    if (!ownsByUser && !ownsBySession) {
      return json(403, { error: "Not authorized to re-run this analysis" });
    }
    analysis_id = existing.id as string;
    await supabase
      .from("analyses")
      .update({
        session_id,
        context_data,
        input_method,
        status: "pending",
        error_message: null,
      })
      .eq("id", analysis_id);
  } else {
    const { data: created, error: createErr } = await supabase
      .from("analyses")
      .insert({
        session_id,
        context_data,
        input_method,
        status: "pending",
      })
      .select("id")
      .single();
    if (createErr || !created) {
      return json(500, { error: `Could not create analysis row: ${createErr?.message}` });
    }
    analysis_id = created.id as string;
  }

  // Helper to mark a row as failed and return a value (used inside the
  // background task so we can early-return cleanly).
  const failAnalysis = async (msg: string): Promise<void> => {
    await supabase.from("messages_temp").delete().eq("analysis_id", analysis_id);
    await cleanupScreenshots();
    await supabase
      .from("analyses")
      .update({ status: "failed", error_message: msg, completed_at: new Date().toISOString() })
      .eq("id", analysis_id);
  };

  // Best-effort deletion of uploaded screenshots. The app promises the
  // conversation isn't stored, so we clean these up whether the run
  // succeeded or failed.
  const cleanupScreenshots = async (): Promise<void> => {
    try {
      if (screenshot_paths_for_analysis && screenshot_paths_for_analysis.length > 0) {
        await supabase.storage
          .from("analysis-uploads")
          .remove(screenshot_paths_for_analysis);
      }
    } catch (_e) {
      // ignore — not fatal
    }
  };

  // 2. Run the heavy work (extraction + analysis) in the background so the
  // HTTP response returns to the client in <1s even with multi-MB
  // screenshot payloads. The client tracks progress by polling the
  // analyses row by id.
  const runPipeline = async (): Promise<void> => {
    try {
      await processAnalysis();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unexpected analyzer error.";
      await failAnalysis(msg);
    }
  };

  const processAnalysis = async (): Promise<void> => {
    // 2. Fetch active prompt version
  const { data: pv, error: pvErr } = await supabase
    .from("prompt_versions")
    .select("id, prompt_text, model_string, vision_model_string")
    .eq("active", true)
    .eq("kind", "full")
    .maybeSingle();
  if (pvErr || !pv) {
    return failAnalysis("No active prompt version configured.");
  }

  await supabase
    .from("analyses")
    .update({ prompt_version_id: pv.id, status: "extracting" })
    .eq("id", analysis_id);

  // 3. Extract messages (shared parser)
  const { name1, name2 } = context_data;

  let imageUrls: string[] = [];
  if (input_method === "screenshot") {
    // Prefer Storage paths — mint short-lived signed URLs so OpenRouter
    // can fetch the images without us ever putting the bytes in the JSON
    // body. Falls back to inline base64 for older clients.
    if (screenshot_paths_for_analysis && screenshot_paths_for_analysis.length > 0) {
      const signed = await supabase.storage
        .from("analysis-uploads")
        .createSignedUrls(screenshot_paths_for_analysis, 60 * 60);
      if (signed.error || !signed.data) {
        return failAnalysis(
          `Could not sign screenshot URLs: ${signed.error?.message ?? "unknown"}`,
        );
      }
      const missing = signed.data.filter((r) => !r.signedUrl);
      if (missing.length > 0) {
        return failAnalysis("Some screenshots could not be signed. Please retry.");
      }
      imageUrls = signed.data.map((r) => r.signedUrl!);
    } else if (screenshot_base64_for_analysis) {
      imageUrls = screenshot_base64_for_analysis;
    }
  }

  const extracted = await extractMessages({
    input_method,
    name1,
    name2,
    raw_text: raw_text_for_analysis,
    imageUrls,
    model_string: pv.model_string,
    vision_model_string: pv.vision_model_string,
    apiKey: OPENROUTER_API_KEY,
    referer: OPENROUTER_HTTP_REFERER,
    title: OPENROUTER_X_TITLE,
  });
  if ("error" in extracted) {
    return failAnalysis(extracted.error);
  }

  const messages = extracted.messages
    .filter((m) => m && m.content && (m.sender_role === "user" || m.sender_role === "partner"))
    .map((m, i) => ({
      analysis_id,
      sender_role: m.sender_role,
      content: String(m.content),
      timestamp_estimate: m.timestamp_estimate ?? null,
      sequence_order: typeof m.sequence_order === "number" ? m.sequence_order : i + 1,
    }));

  if (messages.length === 0) {
    return failAnalysis("No messages could be extracted from the input.");
  }

  const { error: insErr } = await supabase.from("messages_temp").insert(messages);
  if (insErr) {
    return failAnalysis(`Could not store extracted messages: ${insErr.message}`);
  }

  // 4. Run main analysis
  await supabase.from("analyses").update({ status: "analyzing" }).eq("id", analysis_id);

  const messagesBlock = messages
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .map((m) => {
      const label = m.timestamp_estimate ?? `#${m.sequence_order}`;
      const who = m.sender_role === "user" ? name1 : name2;
      return `[${label}] ${who}: ${m.content}`;
    })
    .join("\n");

  const userBlock = `CONTEXT:
- Names: ${name1} and ${name2}
- Relationship type: ${context_data.relationship_type ?? "romantic"}
- Relationship stage: ${context_data.relationship_stage ?? ""}
- Duration: ${context_data.duration ?? ""}
- Goal for analysis: ${context_data.goal ?? ""}
- Free-text: ${context_data.free_text ?? ""}

MESSAGES:
${messagesBlock}`;

  const analysisBody = {
    model: pv.model_string,
    messages: [
      { role: "system", content: pv.prompt_text },
      { role: "user", content: userBlock },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
    provider: { order: ["Anthropic"], allow_fallbacks: true },
  };

  let resultJson: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await callOpenRouter(
      analysisBody,
      OPENROUTER_API_KEY,
      OPENROUTER_HTTP_REFERER,
      OPENROUTER_X_TITLE,
    );
    if (!r.ok) {
      return failAnalysis(`Analysis failed: ${r.status} ${r.errorText}`);
    }
    const completionTokens = r.data?.usage?.completion_tokens ?? 0;
    if (completionTokens > MAX_OUTPUT_TOKENS) {
      return failAnalysis(
        "Analysis output was unexpectedly large. Please try again with a smaller conversation sample.",
      );
    }
    const raw = r.data?.choices?.[0]?.message?.content ?? "";
    try {
      const { value, cleaned } = extractJsonObject(String(raw));
      resultJson = value;
      if (cleaned) {
        console.warn(
          `[analyze-conversation] analysis JSON needed cleaning for ${analysis_id}`,
        );
      }
      break;
    } catch (_e) {
      if (attempt === 0) continue;
      return failAnalysis("Analysis response was not valid JSON.");
    }
  }

  // Validate required fields
  const required = [
    "meta",
    "headline",
    "sub_scores",
    "communication_diagnostic",
    "attachment_profiles",
    "four_horsemen",
    "bids_for_connection",
    "love_languages",
    "green_flags",
    "yellow_flags",
    "red_flags",
    "hidden_pattern",
    "conversation_prompts",
  ];
  const missing = required.filter((k) => !(k in (resultJson ?? {})));
  if (missing.length > 0) {
    return failAnalysis(`Analysis missing required fields: ${missing.join(", ")}`);
  }

  // 5. Privacy: hard-delete temp messages
  await supabase.from("messages_temp").delete().eq("analysis_id", analysis_id);
  await cleanupScreenshots();

  // 5b. Deterministic couple_type mapping
  const relationshipType = context_data.relationship_type ?? "romantic";
  const couple_type_id = assignCoupleType(resultJson, relationshipType, analysis_id);

  // 6. Finalize
  const { error: updErr } = await supabase
    .from("analyses")
    .update({
      result_json: resultJson,
      message_count: messages.length,
      couple_type_id,
      status: "complete",
      completed_at: new Date().toISOString(),
    })
    .eq("id", analysis_id);
  if (updErr) {
    return failAnalysis(`Could not save analysis: ${updErr.message}`);
  }
  };

  // Fire off the heavy pipeline in the background and return immediately.
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(runPipeline());
  } else {
    // Fallback for local/dev: just don't await — the client polls anyway.
    void runPipeline();
  }

  return json(202, { analysis_id, status: "accepted" });
});