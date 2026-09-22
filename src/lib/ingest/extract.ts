import { supabase } from "@/integrations/supabase/client";
import { canonicalizeParsedConversation, type CanonicalConversation } from "./canonical";
import { parseTranscript } from "./parse";
import type { PreparedScreenshot } from "./images";

export async function extractScreenshotConversation(
  screenshots: PreparedScreenshot[],
  selfSide: "left" | "right",
): Promise<CanonicalConversation> {
  const requestId = crypto.randomUUID();
  const { data, error } = await supabase.functions.invoke("extract-chat-input", {
    body: {
      request_id: requestId,
      screenshot_base64_array: screenshots.map((item) => item.dataUrl),
      self_side: selfSide,
    },
  });
  if (error || !data?.transcript) throw new Error(data?.error ?? error?.message ?? "We couldn't read those screenshots.");
  const parsed = parseTranscript(String(data.transcript));
  const self = parsed.participants.find((person) => person.display_name === "You");
  if (self) self.is_self = true;
  const conversation = canonicalizeParsedConversation(parsed, "paste", `screenshot-preview:${requestId}`);
  conversation.sourceKind = "screenshots";
  conversation.warnings = [...conversation.warnings, ...(Array.isArray(data.warnings) ? data.warnings : [])];
  return conversation;
}