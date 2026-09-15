import { useState } from "react";
import { Check, Link2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { track } from "@/lib/analytics";

/**
 * Owner-only sharing controls for a two-person report.
 *
 * Creating a link publishes a small snapshot the owner explicitly chooses.
 * The private report is never reachable through the link, and revoking stops
 * both viewing and saving straight away.
 */
export function AnalysisSharePanel({ analysisId }: { analysisId: string }) {
  const [includeNames, setIncludeNames] = useState(false);
  const [includeQuotes, setIncludeQuotes] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = token ? `${window.location.origin}/d/${token}` : null;

  const create = async () => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("analysis-share", {
      body: {
        action: "create",
        analysis_id: analysisId,
        session_id: getSessionId(),
        include_names: includeNames,
        include_quotes: includeQuotes,
      },
    });
    setBusy(false);
    if (err || !data?.token) {
      setError("We couldn't create that link. Please try again.");
      return;
    }
    setToken(data.token as string);
    track("analysis_share_created", { include_names: includeNames, include_quotes: includeQuotes });
  };

  const revoke = async () => {
    setBusy(true);
    await supabase.functions.invoke("analysis-share", {
      body: { action: "revoke", analysis_id: analysisId, session_id: getSessionId() },
    });
    setBusy(false);
    setToken(null);
  };

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div data-pdf-exclude="true" className="mt-8 rounded-2xl border border-border bg-card p-5 text-left">
      <h3 className="text-[18px] font-medium">Send the other person their side</h3>
      <p className="mt-1 text-[14px] text-muted-foreground">
        This makes a private link with a short version of the read. By default you both show up as
        “Person A” and “Person B”, with no names, no quotes and no chat text.
      </p>

      <div className="mt-4 space-y-2">
        <label className="flex items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            checked={includeNames}
            onChange={(e) => setIncludeNames(e.target.checked)}
            className="h-4 w-4"
          />
          Show real names
        </label>
        <label className="flex items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            checked={includeQuotes}
            onChange={(e) => setIncludeQuotes(e.target.checked)}
            className="h-4 w-4"
          />
          Include the short evidence quotes
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void create()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-[14px] font-medium text-background disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {token ? "Create a new link" : "Create a share link"}
        </button>
        {token && (
          <button
            type="button"
            onClick={() => void revoke()}
            className="rounded-full border border-border px-5 py-2.5 text-[14px] font-medium hover:bg-muted"
          >
            Turn sharing off
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-[14px] text-destructive">{error}</p>}

      {shareUrl && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
          <p className="break-all text-[13px]">{shareUrl}</p>
          <button
            type="button"
            onClick={() => void copy()}
            className="mt-2 inline-flex items-center gap-2 text-[13px] font-medium underline-offset-2 hover:underline"
          >
            {copied ? <Check className="h-4 w-4" /> : null}
            {copied ? "Copied" : "Copy link"}
          </button>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Anyone with this link can see the short version until you turn sharing off.
          </p>
        </div>
      )}
    </div>
  );
}
