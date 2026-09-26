import { withTestRun } from "../_shared/testRun.ts";
import { inStage, markStage, systemFor } from "../_shared/testRunCore.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  callOpenRouter,
  extractMessages,
} from "../_shared/extractMessages.ts";
import { extractJsonObject } from "../_shared/extractJson.ts";
import { loadCoachingPreferences, coachingPreferenceInstruction } from "../_shared/coachingPreferences.ts";
import { conversationKey, deriveDateMeta, participantFingerprint, recordIngestMeta } from "../_shared/exchangeDates.ts";

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
const MAX_REVIEWED_MESSAGES = 1_000;
const MODEL = "openai/gpt-6-astra";

type ReviewedMessage = { id: string; participant_id?: string | null; raw_sender?: string | null; content: string; order: number; ts?: string | null };
type ReviewedIngestion = { id: string; participants: Array<{ id: string; display_name?: string }>; messages: ReviewedMessage[] };

const parseReviewedIngestion = (value: unknown): ReviewedIngestion | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !candidate.id.startsWith("conv_") || !Array.isArray(candidate.participants) || !Array.isArray(candidate.messages)) return null;
  if (candidate.messages.length < 1 || candidate.messages.length > MAX_REVIEWED_MESSAGES || candidate.participants.length > 15) return null;
  const participants = candidate.participants.filter((person): person is { id: string; display_name?: string } => Boolean(person && typeof person === "object" && typeof (person as Record<string, unknown>).id === "string"));
  if (participants.length !== candidate.participants.length) return null;
  const participantIds = new Set(participants.map((person) => person.id));
  const messages = candidate.messages.filter((message): message is ReviewedMessage => {
    if (!message || typeof message !== "object") return false;
    const item = message as Record<string, unknown>;
    return typeof item.id === "string" && item.id.startsWith("msg_") && typeof item.content === "string" && item.content.trim().length > 0 && item.content.length <= 1_200 && Number.isInteger(item.order) && (!item.participant_id || participantIds.has(String(item.participant_id)));
  });
  return messages.length === candidate.messages.length ? { id: candidate.id, participants, messages } : null;
};

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(withTestRun("decode-conversation", async (req) => {
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

  // Optional: identify the signed-in owner. Used for personal coaching style and to
  // record ownership of a new decode (so Interactive Mode can verify it). Grants no privileges.
  let personalizationUserId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7));
    personalizationUserId = userData?.user?.id ?? null;
  }

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
  const ingestionSupplied = input?.ingestion !== undefined && input?.ingestion !== null;
  const ingestion = parseReviewedIngestion(input?.ingestion);
  const identity = input?.identity_confirmation && typeof input.identity_confirmation === "object" ? input.identity_confirmation as Record<string, unknown> : null;
  const confirmedAbsent = identity?.absent === true;
  const confirmedParticipantId = typeof identity?.participant_id === "string" ? identity.participant_id : null;
  const confirmedSide = identity?.self_side === "left" || identity?.self_side === "right" ? identity.self_side : null;

  if (ingestionSupplied && !ingestion) return json(400, { error: "The reviewed conversation is invalid. Review the upload again." });

  if (!session_id) return json(400, { error: "Missing session_id" });
  const hasImages = !!screenshot_base64_array?.length;
  if (!raw_text?.trim() && !hasImages && !ingestion) {
    return json(400, { error: "input must include raw_text or screenshot_base64_array" });
  }
  if (ingestion) {
    const participantIds = new Set(ingestion.participants.map((person) => person.id));
    const validIdentity = confirmedAbsent || Boolean(confirmedSide) || Boolean(confirmedParticipantId && participantIds.has(confirmedParticipantId));
    if (!validIdentity || (confirmedAbsent && (confirmedParticipantId || confirmedSide))) return json(400, { error: "Confirm your actual participant, screenshot side, or that you are absent." });
  }

  let row_id: string;
  if (decode_id) {
    const { data: existing } = await supabase
      .from("decodes")
      .select("id, session_id, user_id")
      .eq("id", decode_id)
      .maybeSingle();
    if (!existing) return json(404, { error: "Decode not found" });
    if (existing.session_id !== session_id) {
      return json(403, { error: "Not authorized for this decode" });
    }
    row_id = existing.id as string;
    await supabase
      .from("decodes")
      .update({
        status: "pending", error_message: null, source: source ?? null,
        // Record the verified signed-in owner once (never reassign an owned decode).
        ...(personalizationUserId && !existing.user_id ? { user_id: personalizationUserId } : {}),
      })
      .eq("id", row_id);
  } else {
    const { data: created, error: createErr } = await supabase
      .from("decodes")
      .insert({ session_id, source: source ?? null, status: "pending", user_id: personalizationUserId })
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

    let exchange: string;
    if (ingestion) {
      const names = new Map(ingestion.participants.map((person) => [person.id, String(person.display_name ?? "Participant").slice(0, 80)]));
      exchange = ingestion.messages.sort((a, b) => a.order - b.order).map((message) => {
        const label = names.get(message.participant_id ?? "") ?? String(message.raw_sender ?? "Unknown participant").slice(0, 80);
        const role = !confirmedAbsent && confirmedParticipantId === message.participant_id ? " (the user)" : "";
        return `${label}${role}: ${message.content}`;
      }).join("\n");
    } else {
      const extracted = await extractMessages({
        input_method: hasImages ? "screenshot" : "paste",
        name1,
        name2,
        raw_text,
        imageUrls: screenshot_base64_array?.slice(0, MAX_SCREENSHOTS),
        model_string: MODEL,
        vision_model_string: MODEL,
        apiKey: OPENROUTER_API_KEY,
        referer: OPENROUTER_HTTP_REFERER,
        title: OPENROUTER_X_TITLE,
      });
      if ("error" in extracted) return fail(extracted.error);
      const messages = extracted.messages.filter((m) => m && m.content && (m.sender_role === "user" || m.sender_role === "partner")).sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
      if (messages.length === 0) return fail("No messages could be extracted from the input.");
      exchange = messages.map((m) => `${m.sender_role === "user" ? `${name1} (the user)` : `${name2} (the other person)`}: ${m.content}`).join("\n");
    }

    await supabase.from("decodes").update({ status: "analyzing" }).eq("id", row_id);

    const coachingPrefs = await loadCoachingPreferences(supabase as never, personalizationUserId);
    const styleBlock = coachingPreferenceInstruction(coachingPrefs);

    markStage("primary");
    const r = await callOpenRouter(
      {
        model: MODEL,
        messages: [
          { role: "system", content: (await systemFor("quick_take", pv.prompt_text)) + (styleBlock ? `\n\n${styleBlock}` : "") },
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

    // Keep the verified exchange dates and conversation identity BEFORE the
    // report is marked complete (staging reads them) and before any raw text is
    // discarded. Only counts, a range and one-way hashes are stored.
    if (ingestion) {
      const owner = personalizationUserId;
      const meta = deriveDateMeta(
        ingestion.messages,
        ingestion.id.startsWith("conv_") && hasImages ? "ocr_confirmed" : "parsed",
      );
      await recordIngestMeta(supabase as never, {
        userId: owner,
        sourceKind: "quick_take",
        sourceId: row_id,
        meta,
        conversationKey: await conversationKey(ingestion.messages),
        participantFingerprint: await participantFingerprint(
          ingestion.participants.map((person) => String(person.display_name ?? "")),
        ),
      });
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
}));
