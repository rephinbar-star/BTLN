import { useEffect, useState } from "react";
import { Loader2, MessageCircleMore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/useMembership";
import { SharedConversationInput, emptyConversationDraft, type ConversationDraft } from "@/components/ingest/SharedConversationInput";
import { extractScreenshotConversation } from "@/lib/ingest/extract";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { FeedbackControl } from "@/components/feedback/FeedbackControl";

type InteractiveResult = {
  verdict?: string;
  read?: string;
  signals?: string[];
  reply_options?: { tone?: string; text?: string }[];
  provenance_notes?: string;
};

type InteractiveEventType = "sent_reply" | "observed_followup" | "self_report" | "no_reply" | "chose_not_to_reply";
type HistoryEvent = { id: string; event_type: InteractiveEventType; status: string; result_json?: InteractiveResult | null; created_at: string; model?: string | null };

export function InteractiveModePanel({ decodeId }: { decodeId: string }) {
  const { loading, hasInteractiveMode } = useMembership();
  const [mode, setMode] = useState<"sent_reply" | "observed_followup" | "self_report">("sent_reply");
  const [draft, setDraft] = useState<ConversationDraft>(emptyConversationDraft);
  const [reflection, setReflection] = useState("");
  const [speakerOrder, setSpeakerOrder] = useState("them_first");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InteractiveResult | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);

  useEffect(() => {
    if (!hasInteractiveMode) return;
    void supabase.functions.invoke("interactive-mode", { body: { action: "list", decode_id: decodeId } })
      .then(({ data }) => {
        setHistory((data?.events ?? []) as HistoryEvent[]);
        setThreadId((data?.thread_id as string | undefined) ?? null);
      });
  }, [decodeId, hasInteractiveMode]);


  if (loading) return null;
  if (!hasInteractiveMode) {
    return (
      <section className="mt-10 rounded-xl border border-border bg-card p-5">
        <h2 className="text-[18px] font-semibold">Continue with Interactive Mode</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Add what you actually sent and what happened next for an updated take. Interactive Mode requires the Quick Take add-on or Prime and is not available to purchase yet.
        </p>
      </section>
    );
  }

  const submit = async (eventType: InteractiveEventType = mode) => {
    setBusy(true);
    setError(null);
    try {
      const rawText = eventType === "self_report"
        ? reflection
        : draft.conversation?.messages.map((message) => `${message.raw_sender ?? "Unknown"}: ${message.content}`).join("\n") ?? draft.text;
      const { data, error: invokeError } = await supabase.functions.invoke("interactive-mode", {
        body: {
          decode_id: decodeId,
          client_request_id: crypto.randomUUID(),
          event_type: eventType,
          raw_text: rawText,
          screenshot_base64_array: [],
          ingestion: draft.conversation,
          confirmed_self_participant_id: draft.selfParticipantId,
          confirmed_self_side: draft.screenshotSelfSide,
          confirmed_self_absent: draft.selfAbsent,
          speaker_order: eventType === "observed_followup" ? [speakerOrder] : [],
        },
      });
      if (invokeError || data?.error) throw new Error(data?.error ?? invokeError?.message ?? "Could not update this conversation.");
      setResult((data?.result ?? null) as InteractiveResult | null);
      setLastEventId((data?.event_id as string | undefined) ?? null);
      setLastModel((data?.model as string | undefined) ?? null);
      if (data?.thread_id) setThreadId(data.thread_id as string);
      const refreshed = await supabase.functions.invoke("interactive-mode", { body: { action: "list", decode_id: decodeId } });
      setHistory((refreshed.data?.events ?? []) as HistoryEvent[]);
      if (refreshed.data?.thread_id) setThreadId(refreshed.data.thread_id as string);
      setDraft(emptyConversationDraft());
      setReflection("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this conversation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 rounded-xl border border-border bg-card p-5" aria-labelledby="interactive-heading">
      <div className="flex items-start gap-3">
        <MessageCircleMore className="mt-0.5 h-5 w-5" />
        <div>
          <h2 id="interactive-heading" className="text-[18px] font-semibold">Interactive Mode</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">Continue this same conversation. Confirmed sent messages, observed follow-ups, and self-reports stay distinct.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="What are you adding?">
        {([
          ["sent_reply", "What I sent"],
          ["observed_followup", "What happened next"],
          ["self_report", "Private reflection"],
        ] as const).map(([value, label]) => (
          <Button key={value} type="button" variant={mode === value ? "default" : "outline"} className="min-h-11" onClick={() => { setMode(value); setResult(null); }} aria-pressed={mode === value}>{label}</Button>
        ))}
      </div>
      {mode === "observed_followup" && (
        <label className="mt-4 block text-[13px] font-medium">Who spoke first?
          <select value={speakerOrder} onChange={(event) => setSpeakerOrder(event.target.value)} className="mt-1 h-12 w-full rounded-md border border-input bg-background px-3 text-[15px]">
            <option value="them_first">Their message first</option>
            <option value="me_first">My message first</option>
          </select>
        </label>
      )}
      {mode === "self_report" ? <label className="mt-4 block text-[13px] font-medium">What happened, in your own words?<textarea value={reflection} onChange={(event) => setReflection(event.target.value)} maxLength={24000} rows={5} className="mt-1 w-full rounded-md border border-input bg-background p-3 text-[15px] leading-relaxed" /></label> : <div className="mt-4"><SharedConversationInput value={draft} onChange={setDraft} maxScreenshots={3} compact requireSelf extractScreenshots={extractScreenshotConversation} pastePlaceholder={mode === "sent_reply" ? "You: Paste the response you actually sent" : "Them: Paste the first later message\nYou: Paste your next response"} /></div>}
      {mode === "sent_reply" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => void submit("no_reply")}>I haven&apos;t replied</Button>
          <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => void submit("chose_not_to_reply")}>I chose not to reply</Button>
        </div>
      )}
      <Button type="button" className="mt-4 min-h-11 w-full" disabled={busy || (mode === "self_report" ? !reflection.trim() : !draft.conversation || draft.conversation.format === "screenshots_pending" || !(draft.selfParticipantId || draft.screenshotSelfSide || draft.selfAbsent))} onClick={() => void submit()}>
        {busy ? <><Loader2 className="animate-spin" /> Updating your take…</> : mode === "self_report" ? "Save private reflection" : "Get an updated take"}
      </Button>
      {error && <p role="alert" className="mt-3 text-[13px] text-destructive">{error}</p>}
      {result && (
        <div className="mt-5 border-t border-border pt-5" aria-live="polite">
          <h3 className="text-[18px] font-semibold">{result.verdict ?? "Updated take"}</h3>
          {result.read && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{result.read}</p>}
          {!!result.reply_options?.length && <div className="mt-4 space-y-2">{result.reply_options.map((reply, index) => <div key={`${reply.tone}-${index}`} className="rounded-md border border-border p-3"><p className="text-[12px] font-semibold uppercase text-muted-foreground">{reply.tone}</p><p className="mt-1 text-[15px]">{reply.text}</p></div>)}</div>}
          {result.provenance_notes && <p className="mt-3 text-[12px] text-muted-foreground">{result.provenance_notes}</p>}
        </div>
      )}
      {history.length > 0 && (
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-[15px] font-semibold">This conversation’s updates</h3>
          <ol className="mt-2 space-y-2">
            {history.map((item) => (
              <li key={item.id} className="rounded-md border border-border p-3 text-[13px]">
                <p className="font-medium">{item.event_type === "sent_reply" ? "Confirmed sent response" : item.event_type === "observed_followup" ? "Observed follow-up" : item.event_type === "self_report" ? "Private self-report" : item.event_type === "no_reply" ? "No reply yet" : "Chose not to reply"}</p>
                <p className="mt-1 text-muted-foreground">{new Date(item.created_at).toLocaleString()} · {item.status}</p>
                {item.result_json?.read && <p className="mt-2 leading-relaxed">{item.result_json.read}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}