import { extractMessages } from "../_shared/extractMessages.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const MODEL = "openai/gpt-6-astra";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IMAGES = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const body = await req.json().catch(() => null);
  const requestId = String(body?.request_id ?? "");
  const images = Array.isArray(body?.screenshot_base64_array) ? body.screenshot_base64_array : [];
  const side = body?.self_side === "left" ? "left" : body?.self_side === "right" ? "right" : null;
  if (!UUID_RE.test(requestId) || !side || images.length < 1 || images.length > MAX_IMAGES) return json(400, { error: "Add up to 10 screenshots and confirm which side is you." });
  if (images.some((image: unknown) => typeof image !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(image) || image.length > 3_000_000)) return json(413, { error: "One screenshot is too large or unreadable. Use PNG, JPG or WebP." });
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return json(503, { error: "Screenshot reading is not configured." });
  const extracted = await extractMessages({ input_method: "screenshot", name1: "You", name2: "Them", imageUrls: images, self_side: side, model_string: MODEL, vision_model_string: MODEL, apiKey: key, referer: Deno.env.get("OPENROUTER_HTTP_REFERER") ?? "https://betweenthelines.app", title: "BetweenTheLines" });
  if ("error" in extracted) return json(502, { error: extracted.error });
  const messages = extracted.messages.slice(0, 1000).filter((message) => message.content?.trim());
  if (!messages.length) return json(422, { error: "No readable messages were found. Reorder clearer screenshots or use paste text." });
  const seen = new Set<string>();
  let overlaps = 0;
  const lines: string[] = [];
  for (const message of messages) {
    const label = message.sender_role === "user" ? "You" : "Them";
    const keyValue = `${label}|${message.timestamp_estimate ?? ""}|${message.content.trim()}`;
    if (seen.has(keyValue)) { overlaps += 1; continue; }
    seen.add(keyValue);
    lines.push(`${label}: ${message.content.trim()}`);
  }
  return json(200, { transcript: lines.join("\n"), message_count: lines.length, warnings: overlaps ? [`${overlaps} exact overlapping message${overlaps === 1 ? " was" : "s were"} removed. Review the preview for uncertain overlap.`] : [] });
});