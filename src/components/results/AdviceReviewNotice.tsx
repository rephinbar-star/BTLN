import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";

export type AdviceIntegrity = {
  withheld_count?: number;
  note?: string | null;
  review?: { status?: "complete" | "pending" | "unavailable" | string; verified?: number; unresolved?: number; attempts?: number; max_attempts?: number; can_retry?: boolean } | null;
};

type Props = {
  integrity: AdviceIntegrity | undefined | null;
  analysisId?: string;
  /** Called after a finished check changed the report. Defaults to reloading the page. */
  onUpdated?: () => void;
  /** Component review only: never calls the server. */
  preview?: boolean;
};

const FALLBACK_HELD = "Some advice was held back because it didn't seem to be meant for the person it was addressed to.";

/**
 * Plain-language status of the "who is this advice for" check. Unknown or
 * future statuses fall back to the server-written note, so older and newer
 * report shapes both render truthfully.
 */
export function AdviceReviewNotice({ integrity, analysisId, onUpdated, preview }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  if (!integrity) return null;
  const review = integrity.review ?? null;
  const status = review?.status;
  const pending = status === "pending";
  const unavailable = status === "unavailable";
  const note = integrity.note ?? (integrity.withheld_count ? FALLBACK_HELD : null);
  if (!note && !pending && !unavailable) return null;
  const canRetry = pending && review?.can_retry !== false && !exhausted;

  const finish = async () => {
    if (preview) { setMessage("Preview only — no check was run."); return; }
    if (!analysisId || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke("advice-review", { body: { action: "retry", analysis_id: analysisId, session_id: getSessionId() } });
      if (error) throw error;
      const d = data as { ok?: boolean; reason?: string; review?: { status?: string } | null };
      if (d?.ok) { (onUpdated ?? (() => window.location.reload()))(); return; }
      const reason = d?.reason ?? "";
      if (reason === "in_flight") setMessage("A check is already running. Give it a moment, then refresh.");
      else if (reason === "too_soon") setMessage("Please wait a few seconds and try again.");
      else { setExhausted(true); setMessage("We couldn't finish checking these suggestions, so they'll stay hidden. The rest of your analysis is unchanged."); }
    } catch {
      setMessage("Something went wrong. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="note" aria-live="polite" className="rounded-lg border border-border bg-muted p-3 text-[13px] leading-relaxed text-muted-foreground">
      <p>{note}</p>
      {canRetry && (
        <Button type="button" variant="outline" size="sm" className="mt-2 min-h-[44px]" onClick={finish} disabled={busy} aria-busy={busy}>
          {busy ? "Checking…" : "Finish checking suggestions"}
        </Button>
      )}
      {message && <p className="mt-2 text-foreground">{message}</p>}
    </div>
  );
}
