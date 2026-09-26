import { INTERACTIVE_SYSTEM } from "../_shared/modePrompts.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { callOpenRouter, extractMessages } from "../_shared/extractMessages.ts";
import { extractJsonObject } from "../_shared/extractJson.ts";
import { loadCoachingPreferences, coachingPreferenceInstruction } from "../_shared/coachingPreferences.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = "openai/gpt-6-astra";
const MAX_SCREENSHOTS = 3;
const MAX_TEXT_CHARS = 24_000;
const MAX_CONTEXT_EVENTS = 12;
const MAX_EVENTS_PER_THREAD = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type EventType = "sent_reply" | "no_reply" | "chose_not_to_reply" | "observed_followup" | "self_report";
type CanonicalMessage = { id: string; participant_id?: string | null; raw_sender?: string | null; content: string; order: number };
type ReviewedIngestion = { id: string; participants: Array<{ id: string; display_name?: string }>; messages: CanonicalMessage[] };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const hashText = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const active = (row: { status?: string; current_period_end?: string | null }) =>
  ["active", "trialing", "past_due"].includes(row.status ?? "") &&
  (!row.current_period_end || new Date(row.current_period_end).getTime() > Date.now());

const reviewedIngestion = (value: unknown): ReviewedIngestion | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !candidate.id.startsWith("conv_") || !Array.isArray(candidate.participants) || !Array.isArray(candidate.messages)) return null;
  if (candidate.messages.length < 1 || candidate.messages.length > 1_000 || candidate.participants.length > 15) return null;
  const participants = candidate.participants.filter((person): person is { id: string; display_name?: string } => Boolean(person && typeof person === "object" && typeof (person as Record<string, unknown>).id === "string"));
  if (participants.length !== candidate.participants.length) return null;
  const participantIds = new Set(participants.map((person) => person.id));
  const messages = candidate.messages.filter((message): message is CanonicalMessage => {
    if (!message || typeof message !== "object") return false;
    const item = message as Record<string, unknown>;
    return typeof item.id === "string" && item.id.startsWith("msg_") && typeof item.content === "string" && item.content.trim().length > 0 && item.content.length <= 1_200 && Number.isInteger(item.order) && (!item.participant_id || participantIds.has(String(item.participant_id)));
  });
  return messages.length === candidate.messages.length ? { id: candidate.id, participants, messages } : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("OPENROUTER_API_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !anon || !service || !authorization) return json(401, { error: "Sign in required" });

  const auth = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: { user }, error: userError } = await auth.auth.getUser();
  if (userError || !user) return json(401, { error: "Sign in required" });

  const payload = await req.json().catch(() => null);
  const decodeId = payload?.decode_id;
  const requestId = payload?.client_request_id;
  const eventType = payload?.event_type as EventType;
  const action = payload?.action === "list" ? "list" : "continue";
  const rawText = typeof payload?.raw_text === "string" ? payload.raw_text.trim() : "";
  const ingestionSupplied = payload?.ingestion !== undefined && payload?.ingestion !== null;
  const ingestion = reviewedIngestion(payload?.ingestion);
  const confirmedParticipantId = typeof payload?.confirmed_self_participant_id === "string" ? payload.confirmed_self_participant_id : null;
  const confirmedSelfSide = payload?.confirmed_self_side === "left" || payload?.confirmed_self_side === "right" ? payload.confirmed_self_side : null;
  const confirmedAbsent = payload?.confirmed_self_absent === true;
  if (ingestionSupplied && !ingestion) return json(400, { error: "The reviewed conversation is invalid. Review the upload again." });
  const screenshots = Array.isArray(payload?.screenshot_base64_array) ? payload.screenshot_base64_array : [];
  // A later exchange carries its own date or none at all. When the person tells
  // us when it happened it is kept as self-reported, never as a verified date,
  // and it is never inherited from the original conversation.
  const suppliedDay = typeof payload?.exchange_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.exchange_date)
    ? payload.exchange_date
    : null;
  const exchangeDay = suppliedDay && Date.parse(`${suppliedDay}T00:00:00Z`) <= Date.now() + 86_400_000 ? suppliedDay : null;
  const speakerOrder = Array.isArray(payload?.speaker_order) ? payload.speaker_order : [];
  const allowedEvents: EventType[] = ["sent_reply", "no_reply", "chose_not_to_reply", "observed_followup", "self_report"];
  if (!UUID_RE.test(String(decodeId)) || (action === "continue" && (!UUID_RE.test(String(requestId)) || !allowedEvents.includes(eventType)))) {
    return json(400, { error: "Invalid Interactive Mode request" });
  }
  if (rawText.length > MAX_TEXT_CHARS || screenshots.length > MAX_SCREENSHOTS) {
    return json(413, { error: "This update is too large. Add a shorter excerpt or up to three screenshots." });
  }
  const needsContent = eventType === "sent_reply" || eventType === "observed_followup" || eventType === "self_report";
  if (needsContent && !rawText && screenshots.length === 0 && !ingestion) return json(400, { error: "Add what happened before continuing." });
  if (eventType === "observed_followup" && speakerOrder.length === 0) return json(400, { error: "Confirm who spoke first." });
  if ((eventType === "sent_reply" || eventType === "observed_followup") && ingestion) {
    const participantIds = new Set(ingestion.participants.map((person) => person.id));
    const validIdentity = confirmedAbsent || Boolean(confirmedSelfSide) || Boolean(confirmedParticipantId && participantIds.has(confirmedParticipantId));
    if (!validIdentity || (confirmedAbsent && (confirmedSelfSide || confirmedParticipantId))) return json(400, { error: "Confirm your actual participant, screenshot side, or that you are absent." });
  }

  const [{ data: entitlementRows }, { data: subscriptionRows }, { data: decode }] = await Promise.all([
    admin.from("subscription_entitlements").select("status,current_period_end,entitlement").eq("user_id", user.id).in("entitlement", ["quick_take", "interactive_mode", "prime"]),
    admin.from("user_subscriptions").select("status,current_period_end,tier").eq("user_id", user.id).in("tier", ["decode_monthly", "interactive_addon", "prime"]),
    admin.from("decodes").select("id,user_id,status,result_json,created_at").eq("id", decodeId).maybeSingle(),
  ]);
  const activeEntitlements = (entitlementRows ?? []).filter(active).map((row) => row.entitlement);
  const activeTiers = (subscriptionRows ?? []).filter(active).map((row) => row.tier);
  const prime = activeEntitlements.includes("prime") || activeTiers.includes("prime");
  const hasAddon = activeEntitlements.includes("interactive_mode") || activeTiers.includes("interactive_addon");
  const hasBase = activeEntitlements.includes("quick_take") || activeTiers.includes("decode_monthly");
  if (!prime && !(hasAddon && hasBase)) return json(402, { error: "Interactive Mode requires both an active Quick Take plan and add-on, or Prime." });
  if (!decode || decode.user_id !== user.id || decode.status !== "complete") return json(403, { error: "That Quick Take is not available to this account." });

  const { data: ownedThread } = await admin.from("interactive_threads").select("id,context_version,structured_context").eq("user_id", user.id).eq("decode_id", decodeId).maybeSingle();
  if (action === "list") {
    if (!ownedThread) return json(200, { events: [] });
    const { data: history, error: historyError } = await admin.from("interactive_events")
      .select("id,event_type,input_method,provenance,status,result_json,model,created_at,completed_at")
      .eq("user_id", user.id).eq("thread_id", ownedThread.id).order("created_at", { ascending: true }).limit(MAX_EVENTS_PER_THREAD);
    if (historyError) return json(500, { error: "Could not load this continuation." });
    return json(200, { thread_id: ownedThread.id, events: history ?? [] });
  }

  const { data: existingEvent } = await admin.from("interactive_events").select("id,thread_id,status,result_json,model").eq("user_id", user.id).eq("client_request_id", requestId).maybeSingle();
  // A retry of the same client_request_id returns the original outcome in the same
  // shape as the first response: no second model call, no second event, no extra cost.
  if (existingEvent) {
    return json(200, {
      event_id: existingEvent.id,
      thread_id: existingEvent.thread_id,
      status: existingEvent.status,
      result: existingEvent.result_json ?? null,
      model: existingEvent.model ?? null,
      duplicate: true,
    });
  }

  const { data: thread, error: threadError } = await admin.from("interactive_threads").upsert({
    user_id: user.id,
    decode_id: decodeId,
    status: "active",
  }, { onConflict: "user_id,decode_id" }).select("id,context_version,structured_context").single();
  if (threadError || !thread) return json(500, { error: "Could not open this continuation." });
  const { count: eventCount } = await admin.from("interactive_events").select("id", { count: "exact", head: true }).eq("thread_id", thread.id);
  if ((eventCount ?? 0) >= MAX_EVENTS_PER_THREAD) return json(409, { error: "This continuation has reached its supported update limit. Start a new Quick Take to continue." });

  const contentFingerprint = ingestion ? JSON.stringify(ingestion.messages.map(({ id, participant_id, content, order }) => ({ id, participant_id, content, order }))) : rawText || screenshots.join("|");
  const { data: event, error: eventError } = await admin.from("interactive_events").insert({
    user_id: user.id,
    thread_id: thread.id,
    client_request_id: requestId,
    event_type: eventType,
    input_method: screenshots.length ? "screenshot" : rawText ? "text" : "none",
    speaker_order: speakerOrder,
    content_hash: contentFingerprint ? await hashText(contentFingerprint) : null,
    provenance: {
      source: eventType === "sent_reply" ? "confirmed_sent" : eventType === "observed_followup" ? "observed_exchange" : "self_reported",
      screenshot_count: screenshots.length,
      original_decode_id: decodeId,
      canonical_conversation_id: ingestion?.id ?? null,
      confirmed_self_participant_id: confirmedParticipantId,
      confirmed_self_side: confirmedSelfSide,
      confirmed_self_absent: confirmedAbsent,
      exchange_date: exchangeDay,
      exchange_date_provenance: exchangeDay ? "user_supplied" : "unknown",
    },
    status: "pending",
    started_from_version: thread.context_version,
    model: eventType === "self_report" || eventType === "no_reply" || eventType === "chose_not_to_reply" ? null : MODEL,
  }).select("id").single();
  if (eventError || !event) return json(500, { error: "Could not record this update." });

  if (eventType === "self_report" || eventType === "no_reply" || eventType === "chose_not_to_reply") {
    const result = eventType === "self_report"
      ? { self_reported: true, note: "Your private reflection was recorded separately from observed evidence." }
      : { self_reported: true, state: eventType };
    await admin.from("interactive_events").update({ status: "complete", result_json: result, completed_at: new Date().toISOString() }).eq("id", event.id);
    await admin.from("interactive_threads").update({ context_version: thread.context_version + 1, last_event_at: new Date().toISOString() }).eq("id", thread.id).eq("context_version", thread.context_version);
    return json(200, { event_id: event.id, thread_id: thread.id, status: "complete" });
  }
  if (!aiKey) {
    await admin.from("interactive_events").update({ status: "failed", error_message: "AI is not configured." }).eq("id", event.id);
    return json(503, { error: "Interactive analysis is not configured." });
  }

  try {
    await admin.from("interactive_events").update({ status: "extracting" }).eq("id", event.id);
    const extracted = ingestion
      ? { messages: ingestion.messages.map((message) => ({
          sender_role: (confirmedParticipantId && message.participant_id === confirmedParticipantId) || message.raw_sender?.trim().toLowerCase() === "you" ? "user" as const : "partner" as const,
          content: message.content,
          timestamp_estimate: null,
          sequence_order: message.order,
        })) }
      : eventType === "sent_reply" && rawText
      ? { messages: [{ sender_role: "user" as const, content: rawText, timestamp_estimate: null, sequence_order: 1 }] }
      : await extractMessages({
          input_method: screenshots.length ? "screenshot" : "paste",
          name1: "You",
          name2: "Them",
          raw_text: rawText,
          imageUrls: screenshots,
          model_string: MODEL,
          vision_model_string: MODEL,
          apiKey: aiKey,
          referer: Deno.env.get("OPENROUTER_HTTP_REFERER") ?? "https://betweenthelines.app",
          title: "BetweenTheLines",
        });
    if ("error" in extracted || extracted.messages.length === 0) throw new Error("We could not read that update.");
    const messages = extracted.messages.slice(0, 80).map((message, index) => ({
      speaker: message.sender_role === "user" ? "you" : "them",
      order: index + 1,
      content: message.content.slice(0, 1200),
    }));
    const coachingPrefs = await loadCoachingPreferences(admin as never, user.id);
    const { data: priorRows } = await admin.from("interactive_events").select("event_type,result_json,created_at").eq("thread_id", thread.id).eq("status", "complete").order("created_at", { ascending: true }).limit(MAX_CONTEXT_EVENTS);
    await admin.from("interactive_events").update({ status: "analyzing" }).eq("id", event.id);
    const response = await callOpenRouter({
      model: MODEL,
      messages: [
        { role: "system", content: INTERACTIVE_SYSTEM + (coachingPreferenceInstruction(coachingPrefs) ? "\n\n" + coachingPreferenceInstruction(coachingPrefs) : "") },
        { role: "user", content: JSON.stringify({ original_take: decode.result_json, prior_updates: priorRows ?? [], current_event: eventType, confirmed_speaker_order: speakerOrder, messages }) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.35,
    }, aiKey, Deno.env.get("OPENROUTER_HTTP_REFERER") ?? "https://betweenthelines.app", "BetweenTheLines");
    if (!response.ok) throw new Error(`Interactive analysis failed (${response.status}).`);
    const parsed = extractJsonObject(String(response.data?.choices?.[0]?.message?.content ?? "")).value;
    if (!parsed || typeof parsed.read !== "string" || !Array.isArray(parsed.reply_options) || typeof parsed.context_summary !== "string") throw new Error("Interactive analysis returned an invalid result.");
    const cleanResult = {
      verdict: String(parsed.verdict ?? "Updated take").slice(0, 180),
      read: parsed.read.slice(0, 1600),
      signals: parsed.signals?.slice?.(0, 4) ?? [],
      reply_options: parsed.reply_options.slice(0, 3).map((option: Record<string, unknown>) => ({ tone: String(option.tone ?? "Reply").slice(0, 40), text: String(option.text ?? "").slice(0, 800) })),
      confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
      provenance_notes: String(parsed.provenance_notes ?? "Based on the confirmed continuation.").slice(0, 500),
    };
    const nextContext = {
      original_decode_id: decodeId,
      event_summaries: [...(((thread.structured_context as Record<string, unknown>)?.event_summaries as unknown[]) ?? []), {
        event_id: event.id,
        type: eventType,
        summary: parsed.context_summary.slice(0, 800),
        message_count: messages.length,
      }].slice(-MAX_CONTEXT_EVENTS),
    };
    const { error: contextError } = await admin.from("interactive_threads").update({ structured_context: nextContext, context_version: thread.context_version + 1, last_event_at: new Date().toISOString() }).eq("id", thread.id).eq("context_version", thread.context_version);
    if (contextError) throw new Error("This conversation changed while the update was running. Submit it again.");
    await admin.from("interactive_events").update({ status: "complete", result_json: cleanResult, completed_at: new Date().toISOString(), usage_json: response.data?.usage ?? {} }).eq("id", event.id).eq("status", "analyzing");
    return json(200, { event_id: event.id, thread_id: thread.id, status: "complete", result: cleanResult, model: MODEL });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Interactive analysis failed.";
    await admin.from("interactive_events").update({ status: "failed", error_message: message }).eq("id", event.id);
    return json(500, { error: message });
  }
});