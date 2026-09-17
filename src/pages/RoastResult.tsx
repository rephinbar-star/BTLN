import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import * as htmlToImage from "html-to-image";
import { AlertTriangle, Check, Copy, Download, Flame, Link2, Loader2, ShieldAlert } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import { NextSteps } from "@/components/results/NextSteps";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { track } from "@/lib/analytics";
import { RoastStoryCard } from "@/components/roast/RoastShareCard";
import { ROAST_SOURCE_LABEL, type RoastResultJson } from "@/lib/roast/types";

const POLL_MS = 2500;
const TIMEOUT_MS = 180_000;

type Row = {
  id: string;
  status: string;
  tone: string;
  source_type: string;
  source_id: string;
  safety_blocked: boolean;
  result_json: RoastResultJson | null;
  error_message: string | null;
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background text-foreground">
    <Helmet>
      <title>Your roast | BetweenTheLines</title>
      <meta name="robots" content="noindex" />
    </Helmet>
    <Header />
    <main className="mx-auto max-w-2xl px-5 pb-20 pt-12 sm:px-8">{children}</main>
    <Footer />
  </div>
);

const RoastResult = () => {
  const { roastId } = useParams<{ roastId: string }>();
  const [row, setRow] = useState<Row | null>(null);
  const rowRef = useRef<Row | null>(null);
  useEffect(() => {
    rowRef.current = row;
  }, [row]);

  const [timedOut, setTimedOut] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const emptyLoads = useRef(0);
  const startedAt = useRef(Date.now());
  const tracked = useRef(false);

  const [includeNames, setIncludeNames] = useState(false);
  const [includeQuotes, setIncludeQuotes] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!roastId) return;
    const { data } = await supabase.rpc("get_roast_for_session", {
      p_id: roastId,
      p_session_id: getSessionId(),
    });
    const r = (Array.isArray(data) ? data[0] : data) as Row | undefined;
    if (r) {
      setRow(r);
      setNotFound(false);
    } else {
      emptyLoads.current += 1;
      if (emptyLoads.current >= 3) setNotFound(true);
    }
  }, [roastId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      const status = rowRef.current?.status;
      if (status === "complete" || status === "failed" || status === "blocked") {
        window.clearInterval(t);
        return;
      }
      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        setTimedOut(true);
        window.clearInterval(t);
        return;
      }
      void load();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!row || tracked.current) return;
    if (row.status === "complete") {
      tracked.current = true;
      track("roast_completed", { source_type: row.source_type, tone: row.tone });
    } else if (row.status === "blocked") {
      tracked.current = true;
      track("roast_safety_blocked", { source_type: row.source_type });
    } else if (row.status === "failed") {
      tracked.current = true;
      track("roast_failed", { reason_code: "generation_failed" });
    }
  }, [row]);

  const result = row?.result_json ?? null;
  const nameById = new Map((result?.subjects ?? []).map((s) => [s.id, s.display_name]));
  const backHref =
    row?.source_type === "group_read" ? `/group/${row?.source_id}` : `/report/${row?.source_id}`;

  const createShare = async () => {
    if (!roastId) return;
    setSharing(true);
    setShareError(null);
    const { data, error } = await supabase.functions.invoke("roast-share", {
      body: {
        action: "create",
        roast_id: roastId,
        session_id: getSessionId(),
        include_names: includeNames,
        include_quotes: includeQuotes,
      },
    });
    setSharing(false);
    if (error || !data?.token) {
      setShareError("We couldn't create that link. Please try again.");
      return;
    }
    setShareToken(data.token as string);
    track("roast_share_created", { include_names: includeNames, include_quotes: includeQuotes });
  };

  const revokeShare = async () => {
    if (!roastId) return;
    setSharing(true);
    await supabase.functions.invoke("roast-share", {
      body: { action: "revoke", roast_id: roastId, session_id: getSessionId() },
    });
    setSharing(false);
    setShareToken(null);
  };

  const shareUrl = shareToken ? `${window.location.origin}/r/${shareToken}` : null;

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const saveCard = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await htmlToImage.toPng(cardRef.current, { pixelRatio: 1, cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "roast.png";
      a.click();
      track("roast_card_saved", {});
    } finally {
      setExporting(false);
    }
  };

  // ---- states -------------------------------------------------------------

  if (!row && notFound) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="text-[20px] font-medium">We can't find that roast</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Roasts are private to whoever made them.
          </p>
          <Link
            to="/roast"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background"
          >
            Roast one of yours
          </Link>
        </div>
      </Shell>
    );
  }

  if (!row) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      </Shell>
    );
  }

  if (row.status === "blocked") {
    return (
      <Shell>
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6">
          <h1 className="flex items-center gap-2 text-[20px] font-medium">
            <ShieldAlert className="h-5 w-5 text-destructive" /> We're not joking about this one
          </h1>
          <p className="mt-2 text-[15px]">
            {result?.message ??
              "There's something in this conversation we won't make jokes about."}
          </p>
          <Link
            to={backHref}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background"
          >
            Back to the serious read
          </Link>
        </div>
      </Shell>
    );
  }

  if (row.status === "failed" || (timedOut && row.status !== "complete")) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="flex items-center gap-2 text-[20px] font-medium">
            <AlertTriangle className="h-5 w-5 text-destructive" /> That didn't finish
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {row.error_message ?? "It took longer than expected."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to={`/roast?source=${row.source_type}&id=${row.source_id}`}
              className="rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background"
            >
              Try again
            </Link>
            <Link
              to={backHref}
              className="rounded-full border border-border px-6 py-3 text-[15px] font-medium hover:bg-muted/50"
            >
              Back to the serious read
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (row.status !== "complete" || !result) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="flex items-center gap-2 text-[20px] font-medium">
            <Loader2 className="h-5 w-5 animate-spin" /> Warming up…
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Finding the funny bits in a read you already have. About half a minute.
          </p>
        </div>
      </Shell>
    );
  }

  const observations = (result.observations ?? []).map((o, i) => ({
    label: nameById.get(o.subject_id ?? "") ?? `Someone ${i + 1}`,
    text: o.text ?? "",
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Your roast | BetweenTheLines</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-10 sm:px-8">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Flame className="h-4 w-4" /> Roast Us · from your{" "}
          {ROAST_SOURCE_LABEL[result.source_type ?? "analysis"] ?? "read"}
        </p>
        <h1 className="mt-3 text-[30px] font-medium leading-tight tracking-tight sm:text-[38px]">
          {result.headline}
        </h1>

        <ul className="mt-8 space-y-3">
          {observations.map((o, i) => (
            <li key={i} className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[17px] font-medium">{o.label}</h2>
              <p className="mt-2 text-[16px] leading-relaxed">{o.text}</p>
            </li>
          ))}
        </ul>

        {result.receipt?.quote && (
          <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              The receipt
            </h2>
            <p className="mt-2 border-l-2 border-border pl-3 text-[16px] italic">
              “{result.receipt.quote}”
            </p>
            {result.receipt.note && (
              <p className="mt-2 text-[15px] text-muted-foreground">{result.receipt.note}</p>
            )}
          </div>
        )}

        {result.closing && (
          <p className="mt-6 text-[17px] leading-relaxed text-muted-foreground">{result.closing}</p>
        )}

        {(result.seriously?.length ?? 0) > 0 && (
          <section className="mt-10 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-[20px] font-medium">Okay, but seriously…</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px]">
              {result.seriously!.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <Link
              to={backHref}
              className="mt-4 inline-block text-[14px] underline underline-offset-4"
            >
              See the full serious read
            </Link>
          </section>
        )}

        {/* Sharing */}
        <section className="mt-10 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-[20px] font-medium">Share it</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Nothing is shared until you make a link. By default names are swapped for “Person A”
            and quotes are left out. Swapped names make it harder to identify people — they don't
            make it impossible, so only share what you'd be happy for everyone in the chat to see.
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
              Include the receipt quote
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={createShare}
              disabled={sharing}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-[15px] font-medium text-background disabled:opacity-40"
            >
              {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {shareToken ? "Create a new link" : "Create a share link"}
            </button>
            {shareToken && (
              <button
                type="button"
                onClick={revokeShare}
                className="rounded-full border border-border px-5 py-3 text-[15px] font-medium hover:bg-muted/50"
              >
                Turn sharing off
              </button>
            )}
            <button
              type="button"
              onClick={saveCard}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-[15px] font-medium hover:bg-muted/50 disabled:opacity-40"
            >
              <Download className="h-4 w-4" /> Save the card
            </button>
          </div>

          {shareError && <p className="mt-3 text-[14px] text-destructive">{shareError}</p>}

          {shareUrl && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3">
              <code className="min-w-0 flex-1 truncate text-[13px]">{shareUrl}</code>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[13px]"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </section>

        <p className="mt-8 text-[14px] text-muted-foreground">
          Want another angle?{" "}
          <Link to="/group" className="underline underline-offset-4">
            Read a group chat
          </Link>{" "}
          or{" "}
          <Link to="/" className="underline underline-offset-4">
            start a new read
          </Link>
          .
        </p>
      </main>

      {/* Off-screen export node */}
      <div style={{ position: "fixed", left: -99999, top: 0 }} aria-hidden>
        <RoastStoryCard
          ref={cardRef}
          headline={result.headline ?? "Roast Us"}
          observations={observations}
          closing={result.closing ?? ""}
        />
      </div>

      <NextSteps mode="roast" />
      <Footer />
    </div>
  );
};

export default RoastResult;
