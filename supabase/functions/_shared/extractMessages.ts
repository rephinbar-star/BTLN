// Shared message-extraction parser used by both the full report pipeline
// (analyze-conversation) and the Quick Decode lane (decode-conversation).

import { extractJsonObject } from "./extractJson.ts";
export { extractJsonObject, stripFences } from "./extractJson.ts";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ExtractedMsg = {
  sender_role: "user" | "partner";
  content: string;
  timestamp_estimate: string | null;
  sequence_order: number;
};



const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callOpenRouter(
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
      const parsed = extractJsonObject(String(raw)).value;
      if (Array.isArray(parsed?.messages)) {
        return { messages: parsed.messages as ExtractedMsg[] };
      }
      throw new Error("missing messages array");
    } catch (_e) {
      if (attempt === 0) {
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

export type ExtractParams = {
  input_method: "paste" | "chat_file" | "screenshot";
  name1: string;
  name2: string;
  raw_text?: string;
  /** Signed URLs or data: URLs for screenshot input. */
  imageUrls?: string[];
  model_string: string;
  vision_model_string: string;
  apiKey: string;
  referer: string;
  title: string;
};

export async function extractMessages(
  p: ExtractParams,
): Promise<{ messages: ExtractedMsg[] } | { error: string }> {
  const { name1, name2 } = p;

  const parsingSystem = `You are a parser. Convert the conversation text into a structured JSON array of messages. The user's name is ${name1}; their partner's name is ${name2}. Each message has: sender_role ("user" if ${name1} sent it, "partner" if ${name2} sent it), content (verbatim text), timestamp_estimate (extract if present, else null), sequence_order (integer starting at 1).

Handle WhatsApp export format ([DD/MM/YY, HH:MM:SS] Name: text), iMessage paste format, and unstructured text. If sender attribution is ambiguous, infer from context (alternation, message style).

Return ONLY a JSON object: { "messages": [...] }. No preamble, no code fences.`;

  const visionSystem = `You are a vision parser for messaging app screenshots. Extract the conversation into structured JSON. Each message: sender_role ("user" or "partner"), content (verbatim including emojis), timestamp_estimate (extract if visible), sequence_order.

Determining sender: in iMessage, WhatsApp, and most apps, messages aligned to the right side are typically the user's; messages aligned to the left are the partner's. Use this convention. If multiple screenshots, maintain sequential ordering across them based on visual order.

The user's name is ${name1}. The partner's name is ${name2}.

Return ONLY a JSON object: { "messages": [...] }. No preamble, no code fences.`;

  let extractionBody: Record<string, unknown>;
  if (p.input_method === "screenshot") {
    const userContent: any[] = [
      {
        type: "text",
        text: `Extract messages from these screenshots. User's name: ${name1}. Partner's name: ${name2}.`,
      },
      ...(p.imageUrls ?? []).map((url) => ({
        type: "image_url",
        image_url: { url },
      })),
    ];
    extractionBody = {
      model: p.vision_model_string,
      messages: [
        { role: "system", content: visionSystem },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    };
  } else {
    extractionBody = {
      model: p.model_string,
      messages: [
        { role: "system", content: parsingSystem },
        { role: "user", content: p.raw_text! },
      ],
      response_format: { type: "json_object" },
      provider: { order: ["Anthropic"], allow_fallbacks: true },
    };
  }

  return await extractWithRetry(extractionBody, p.apiKey, p.referer, p.title);
}
