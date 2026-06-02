import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_OUTPUT_TOKENS = 8000;

type ContextData = {
  name1: string;
  name2: string;
  relationship_type?: "romantic" | "friend" | "family";
  relationship_stage?: string;
  duration?: string;
  goal?: string;
  free_text?: string;
};

type ExtractedMsg = {
  sender_role: "user" | "partner";
  content: string;
  timestamp_estimate: string | null;
  sequence_order: number;
};

const stripFences = (s: string): string => {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  return t.trim();
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callOpenRouter(
  body: Record<string, unknown>,
  apiKey: string,
  referer: string,
  title: string,
): Promise<{ ok: boolean; status: number; data?: any; errorText?: string }> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": referer,
        "X-Title": title,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    last = res;
    if (res.ok) {
      const data = await res.json();
      return { ok: true, status: res.status, data };
    }
    if (res.status >= 500 && attempt === 0) {
      await sleep(2000);
      continue;
    }
    const text = await res.text();
    return { ok: false, status: res.status, errorText: text };
  }
  const text = last ? await last.text() : "Unknown error";
  return { ok: false, status: last?.status ?? 500, errorText: text };
}

async function extractWithRetry(
  body: Record<string, unknown>,
  apiKey: string,
  referer: string,
  title: string,
): Promise<{ messages: ExtractedMsg[] } | { error: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await callOpenRouter(body, apiKey, referer, title);
    if (!r.ok) return { error: `Extraction failed: ${r.status} ${r.errorText}` };
    const raw = r.data?.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(stripFences(String(raw)));
      if (Array.isArray(parsed?.messages)) {
        return { messages: parsed.messages as ExtractedMsg[] };
      }
      throw new Error("missing messages array");
    } catch (_e) {
      if (attempt === 0) {
        // append a corrective system note
        const messages = [...(body.messages as any[])];
        messages.push({
          role: "system",
          content:
            "Your previous response was not valid JSON. Please respond with only the JSON object.",
        });
        body = { ...body, messages };
        continue;
      }
      return { error: "Could not parse extracted messages JSON." };
    }
  }
  return { error: "Extraction failed after retry." };
}

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
    "https://couplechemistry.lovable.app";
  const OPENROUTER_X_TITLE = Deno.env.get("OPENROUTER_X_TITLE") ?? "Chemistry";

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
    (!screenshot_base64_array || screenshot_base64_array.length === 0)
  ) {
    return json(400, { error: "screenshot_base64_array is required for screenshot" });
  }

  // 1. Resolve analysis row: update existing if analysis_id provided, else create one.
  let analysis_id: string;
  if (provided_analysis_id) {
    const { data: existing, error: exErr } = await supabase
      .from("analyses")
      .select("id")
      .eq("id", provided_analysis_id)
      .maybeSingle();
    if (exErr || !existing) {
      return json(404, { error: `Analysis row ${provided_analysis_id} not found` });
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
    await supabase
      .from("analyses")
      .update({ status: "failed", error_message: msg, completed_at: new Date().toISOString() })
      .eq("id", analysis_id);
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
    .maybeSingle();
  if (pvErr || !pv) {
    return failAnalysis("No active prompt version configured.");
  }

  await supabase
    .from("analyses")
    .update({ prompt_version_id: pv.id, status: "extracting" })
    .eq("id", analysis_id);

  // 3. Build extraction request
  const { name1, name2 } = context_data;

  const parsingSystem = `You are a parser. Convert the conversation text into a structured JSON array of messages. The user's name is ${name1}; their partner's name is ${name2}. Each message has: sender_role ("user" if ${name1} sent it, "partner" if ${name2} sent it), content (verbatim text), timestamp_estimate (extract if present, else null), sequence_order (integer starting at 1).

Handle WhatsApp export format ([DD/MM/YY, HH:MM:SS] Name: text), iMessage paste format, and unstructured text. If sender attribution is ambiguous, infer from context (alternation, message style).

Return ONLY a JSON object: { "messages": [...] }. No preamble, no code fences.`;

  const visionSystem = `You are a vision parser for messaging app screenshots. Extract the conversation into structured JSON. Each message: sender_role ("user" or "partner"), content (verbatim including emojis), timestamp_estimate (extract if visible), sequence_order.

Determining sender: in iMessage, WhatsApp, and most apps, messages aligned to the right side are typically the user's; messages aligned to the left are the partner's. Use this convention. If multiple screenshots, maintain sequential ordering across them based on visual order.

The user's name is ${name1}. The partner's name is ${name2}.

Return ONLY a JSON object: { "messages": [...] }. No preamble, no code fences.`;

  let extractionBody: Record<string, unknown>;
  if (input_method === "screenshot") {
    const userContent: any[] = [
      {
        type: "text",
        text: `Extract messages from these screenshots. User's name: ${name1}. Partner's name: ${name2}.`,
      },
      ...screenshot_base64_array!.map((url) => ({
        type: "image_url",
        image_url: { url },
      })),
    ];
    extractionBody = {
      model: pv.vision_model_string,
      messages: [
        { role: "system", content: visionSystem },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    };
  } else {
    extractionBody = {
      model: pv.model_string,
      messages: [
        { role: "system", content: parsingSystem },
        { role: "user", content: raw_text! },
      ],
      response_format: { type: "json_object" },
      provider: { order: ["Anthropic"], allow_fallbacks: true },
    };
  }

  const extracted = await extractWithRetry(
    extractionBody,
    OPENROUTER_API_KEY,
    OPENROUTER_HTTP_REFERER,
    OPENROUTER_X_TITLE,
  );
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
      resultJson = JSON.parse(stripFences(String(raw)));
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