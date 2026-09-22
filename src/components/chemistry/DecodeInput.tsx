import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharedConversationInput, emptyConversationDraft, type ConversationDraft } from "@/components/ingest/SharedConversationInput";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId, logEvent } from "@/lib/session";
import { track } from "@/lib/analytics";

export const DecodeInput = () => {
  const [draft, setDraft] = useState<ConversationDraft>(emptyConversationDraft);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const hasInput = draft.method === "screenshots" ? draft.screenshots.length > 0 : Boolean(draft.conversation);
  const identityConfirmed = draft.method === "screenshots" ? Boolean(draft.screenshotSelfSide) : Boolean(draft.selfParticipantId);

  const onSubmit = async () => {
    if (!hasInput || !identityConfirmed || submitting) return;
    setSubmitting(true);
    setError(null);
    const session_id = getSessionId();
    const decode_id = crypto.randomUUID();
    const { error: insertError } = await supabase.from("decodes").insert({ id: decode_id, session_id, status: "pending", source: "quick_decode" });
    if (insertError) {
      setSubmitting(false);
      setError("Something went wrong starting your take. Please retry.");
      return;
    }

    const selected = draft.conversation?.participants.find((person) => person.id === draft.selfParticipantId);
    const other = draft.conversation?.participants.find((person) => person.id !== draft.selfParticipantId);
    const input: Record<string, unknown> = {
      name1: selected?.display_name ?? "You",
      name2: other?.display_name ?? "Them",
      identity_confirmation: draft.method === "screenshots"
        ? { self_side: draft.screenshotSelfSide }
        : { participant_id: draft.selfParticipantId, conversation_id: draft.conversation?.id },
      ingestion: draft.conversation,
    };
    if (draft.method === "screenshots") input.screenshot_base64_array = draft.screenshots.map((shot) => shot.dataUrl);
    else input.raw_text = draft.conversation?.messages.map((message) => `${message.raw_sender ?? "Unknown"}: ${message.content}`).join("\n") ?? draft.text;

    logEvent("decode_started", { has_images: draft.method === "screenshots", image_count: draft.screenshots.length });
    track("decode_started", { input_method: draft.method });
    navigate(`/decode/${decode_id}`);
    void supabase.functions.invoke("decode-conversation", { body: { decode_id, session_id, source: "quick_decode", input } });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
      <SharedConversationInput value={draft} onChange={setDraft} maxScreenshots={10} />
      {!identityConfirmed && hasInput && <p className="mt-3 text-sm text-destructive">Confirm which participant or screenshot side is you before continuing.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <Button type="button" onClick={() => void onSubmit()} disabled={!hasInput || !identityConfirmed || submitting} className="mt-5 min-h-11 w-full rounded-full">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Get my take <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">First take is free. Upload type does not change access. Raw messages and screenshots are processed for this take and are not kept as conversation history.</p>
    </div>
  );
};