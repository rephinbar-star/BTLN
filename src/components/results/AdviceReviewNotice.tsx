import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { SharedConversationInput, emptyConversationDraft, type ConversationDraft } from "@/components/ingest/SharedConversationInput";

export type AdviceIntegrity = {
  withheld_count?: number;
  note?: string | null;
  review?: {
    status?: "complete" | "pending" | "unavailable" | string;
    verified?: number;
    unresolved?: number;
    attempts?: number;
    max_attempts?: number;
    can_retry?: boolean;
    recovery?: "not_available" | "available" | "claimed" | "complete" | "unavailable" | string;
    can_recover?: boolean;
  } | null;
};

type Props = {
  integrity: AdviceIntegrity | undefined | null;
  analysisId?: string;
  /** Called after a recovery changed the report. Defaults to reloading the page. */
  onUpdated?: () => void;
  /** Component review only: never calls the server. */
  preview?: boolean;
  /** Only the owner of an unlocked report (not shared or locked views) is offered recovery. */
  allowRecovery?: boolean;
};

const FALLBACK_HELD = "Some advice was held back because it didn't seem to be meant for the person it was addressed to.";
const UNCHECKED = "Your analysis is complete. Some suggestions couldn't be checked, so we've left them out.";

/** Recovery starts on Import: screenshots are not accepted here. */
const recoveryDraft = (): ConversationDraft => ({ ...emptyConversationDraft(), method: "chat_export" });

export const draftToText = (d: ConversationDraft) =>
  d.conversation && d.conversation.format !== "screenshots_pending"
    ? d.conversation.messages.map((m) => `${m.raw_sender ?? "Unknown"}: ${m.content}`).join("\n")
    : d.text;

const REASONS: Record<string, { text: string; final?: boolean }> = {
  input_mismatch: { text: "That doesn't match the conversation this report was made from. Use exactly the same file or text. Your free recovery hasn't been used." },
  format_unsupported: { text: "We couldn't read two people with the names in this report. Use the same file or text you used the first time. Your free recovery hasn't been used." },
  input_required: { text: "Add the conversation first." },
  too_many_mismatches: { text: "This conversation didn't match too many times, so recovery is closed for this report. The rest of your analysis is unchanged.", final: true },
  not_entitled: { text: "Recovery is available only to the owner of a full report. Sign in to the account that owns it.", final: true },
  in_flight: { text: "A recovery is already running for this report. Give it a minute, then refresh." },
  recovery_used: { text: "This report's free recovery has already been used. The rest of your analysis is unchanged.", final: true },
  not_recoverable: { text: "This report can't be recovered. It was made before recovery was available, or it has nothing left to check. The rest of your analysis is unchanged.", final: true },
  report_changed: { text: "This report changed since these suggestions were written, so they'll stay hidden. The rest of your analysis is unchanged.", final: true },
  checker_version_changed: { text: "These suggestions were written by an older version of the check, so they'll stay hidden. The rest of your analysis is unchanged.", final: true },
  resubmit_required: { text: "To check these suggestions, resubmit the same conversation.", final: false },
};

/**
 * Plain-language status of the "who is this advice for" check, with the
 * optional free resubmission flow. Unknown or older statuses fall back to the
 * server-written note, so older and newer report shapes both render truthfully.
 */
export function AdviceReviewNotice({ integrity, analysisId, onUpdated, preview, allowRecovery = false }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ConversationDraft>(recoveryDraft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (!integrity) return null;
  const review = integrity.review ?? null;
  const status = review?.status;
  // Legacy "pending" (old stored-text retry) is shown as unavailable: that retry no longer exists.
  const unchecked = status === "unavailable" || status === "pending";
  const note = (status === "pending" ? null : integrity.note) ?? (unchecked ? UNCHECKED : integrity.withheld_count ? FALLBACK_HELD : null);
  if (!note) return null;
  const canRecover = allowRecovery && unchecked && review?.can_recover === true && review?.recovery === "available" && !closed;

  const submit = async () => {
    if (preview) { setMessage("Preview only — nothing was sent."); return; }
    if (!analysisId || busy) return;
    const raw_text = draftToText(draft);
    if (!raw_text.trim()) { setMessage(REASONS.input_required.text); return; }
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke("advice-review", { body: { action: "recover", analysis_id: analysisId, session_id: getSessionId(), raw_text } });
      if (error) throw error;
      const d = data as { ok?: boolean; reason?: string; restored?: number };
      if (d?.ok) {
        setDraft(recoveryDraft());
        (onUpdated ?? (() => window.location.reload()))();
        return;
      }
      const r = REASONS[d?.reason ?? ""];
      if (r) { setMessage(r.text); if (r.final) { setClosed(true); setOpen(false); setDraft(recoveryDraft()); } }
      else { setMessage("We couldn't finish checking these suggestions, so they'll stay hidden. The rest of your analysis is unchanged."); setClosed(true); setOpen(false); setDraft(recoveryDraft()); }
    } catch {
      setMessage("Something went wrong. Your free recovery hasn't been used if nothing started — please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="note" aria-live="polite" className="rounded-lg border border-border bg-muted p-3 text-[13px] leading-relaxed text-muted-foreground">
      <p>{note}</p>
      {canRecover && !open && (
        <Button ref={triggerRef} type="button" variant="outline" size="sm" className="mt-2 min-h-[44px]" onClick={() => setOpen(true)} aria-expanded={false}>
          Resubmit to recover suggestions
        </Button>
      )}
      {canRecover && open && (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-background p-3 text-foreground">
          <p className="text-[13px]">
            We don't keep your conversation after an analysis, so we can't recheck these suggestions on our own. If you add the
            <strong> same conversation </strong> again, we'll check only the suggestions we left out. We won't redo the analysis or change anything else in it.
          </p>
          <p className="text-[12px] text-muted-foreground">
            Free: no charge, and no report credit is used. You get one recovery per report. The conversation is deleted as soon as the check ends.
          </p>
          <p className="text-[12px] text-muted-foreground">
            Use the same chat export file or pasted text you used the first time. Reports made from screenshots can't be recovered this way.
          </p>
          <SharedConversationInput value={draft} onChange={setDraft} compact requireSelf={false} allowScreenshots={false} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="min-h-[44px]" onClick={submit} disabled={busy} aria-busy={busy}>
              {busy ? "Checking…" : "Check suggestions"}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" disabled={busy}
              onClick={() => { setOpen(false); setDraft(recoveryDraft()); setMessage(null); requestAnimationFrame(() => triggerRef.current?.focus()); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {message && <p className="mt-2 text-foreground">{message}</p>}
    </div>
  );
}
