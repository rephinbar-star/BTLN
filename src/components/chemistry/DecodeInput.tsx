import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharedConversationInput, emptyConversationDraft, type ConversationDraft } from "@/components/ingest/SharedConversationInput";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId, logEvent } from "@/lib/session";
import { track } from "@/lib/analytics";
import { extractScreenshotConversation } from "@/lib/ingest/extract";

export const DecodeInput = () => {
  const [draft, setDraft] = useState<ConversationDraft>(emptyConversationDraft);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<"input" | "review">("input");
  const navigate = useNavigate();

  const hasInput = Boolean(draft.conversation && draft.conversation.format !== "screenshots_pending" && draft.conversation.sourceKind === draft.method);
  const identityConfirmed = draft.selfAbsent || Boolean(draft.selfParticipantId);

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
      identity_confirmation: draft.selfAbsent ? { absent: true } : { participant_id: draft.selfParticipantId, conversation_id: draft.conversation?.id, ...(draft.conversation?.sourceKind === "screenshots" ? { self_side: draft.screenshotSelfSide } : {}) },
      ingestion: draft.conversation,
    };
    input.raw_text = draft.conversation?.messages.map((message) => `${message.raw_sender ?? "Unknown"}: ${message.content}`).join("\n") ?? draft.text;

    logEvent("decode_started", { has_images: draft.method === "screenshots", image_count: draft.screenshots.length });
    track("decode_started", { input_method: draft.method === "screenshots" ? "screenshot" : "paste" });
    navigate(`/decode/${decode_id}`);
    void supabase.functions.invoke("decode-conversation", { body: { decode_id, session_id, source: "quick_decode", input } });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
      <p className="mb-4 font-mono text-[11px] text-prism-lavender">{stage === "input" ? "Messages" : "Messages  /  Check"}</p>
      <SharedConversationInput value={draft} onChange={(next) => { setDraft(next); if (next.conversation?.id !== draft.conversation?.id && stage === "review" && !next.conversation) setStage("input"); }} maxScreenshots={10} extractScreenshots={extractScreenshotConversation} accent="quick" stage={stage} onReview={() => setStage("review")} onBack={() => setStage("input")} onNext={() => void onSubmit()} nextLabel={submitting ? "Starting…" : "Get my Quick Take"} guidance="Include a few messages before and after." />
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
};
