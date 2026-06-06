import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import * as htmlToImage from "html-to-image";
import { ArrowRight, Copy, Download, Info, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { claimPendingAnalysis, getSessionId, logEvent } from "@/lib/session";
import { getStripeEnvironment } from "@/lib/stripe";
import type { AnalysisResult, AttachmentDimension, ContextData } from "@/lib/analysis-types";
import { ShareableCard } from "@/components/chemistry/ShareableCard";
import { FeedbackModal } from "@/components/chemistry/FeedbackModal";
import { InviteFriendsButton } from "@/components/chemistry/InviteFriendsButton";
import { CoupleTypeCard } from "@/components/CoupleTypeCard";
import type { RelationshipType } from "@/lib/coupleTypes";
import { PaywallBlur } from "@/components/PaywallBlur";
import { useEntitlement } from "@/hooks/useEntitlement";
import { SaveReportModal } from "@/components/auth/SaveReportModal";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Row = {
  id: string;
  status: string;
  result_json: AnalysisResult | null;
  context_data: ContextData;
  message_count: number | null;
  error_message: string | null;
  couple_type_id: number | null;
  relationship_type: string | null;
  is_paid: boolean | null;
  user_id: string | null;
};

type FlagValue = string | { title?: unknown; evidence?: unknown; description?: unknown };

const textFromUnknown = (value: unknown, fallback = "—") => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return fallback;
};

const flagSummary = (flag: FlagValue | null | undefined) => {
  if (!flag) return "";
  if (typeof flag === "string") return flag;
  return [flag.title, flag.description, flag.evidence]
    .map((x) => textFromUnknown(x, ""))
    .filter(Boolean)
    .join(" — ");
};

const evidenceText = (horseman: { evidence_quote?: unknown; evidence?: unknown } | undefined) =>
  textFromUnknown(horseman?.evidence_quote ?? horseman?.evidence, "");

class ReportErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
          <h1 className="text-[28px] font-medium tracking-tight sm:text-[36px]">
            We couldn&apos;t display this report.
          </h1>
          <p className="mt-4 max-w-md text-[15px] text-muted-foreground">
            The analysis finished, but one report field came back in an unexpected format.
          </p>
          <Link
            to="/#input-section"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90"
          >
            Try again
          </Link>
        </div>
      );
    }

    return this.props.children;
  }
}

const sanitizeName = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "person";

const STYLE_PILL: Record<string, string> = {
  secure: "bg-pastel-green-bg text-pastel-green-fg-strong",
  anxious: "bg-pastel-pink-bg text-pastel-pink-fg",
  avoidant: "bg-pastel-amber-bg text-pastel-amber-fg-strong",
  disorganized: "bg-muted text-muted-foreground",
  "mixed/unclear": "bg-muted text-muted-foreground",
};

const STYLE_BAR: Record<string, string> = {
  secure: "bg-pastel-green-fg-strong",
  anxious: "bg-pastel-pink-fg",
  avoidant: "bg-pastel-amber-fg-strong",
  disorganized: "bg-muted-foreground",
};

const ReportContent = () => {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [shareFallbackOpen, setShareFallbackOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [accessClaimChecked, setAccessClaimChecked] = useState(false);
  const [accessRefreshSignal, setAccessRefreshSignal] = useState(0);
  const reportRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const accessLoggedRef = useRef(false);
  const {
    isOwner,
    isAnonymousOwner,
    hasFullAccess,
    isLoading: entitlementLoading,
    refresh: refreshEntitlement,
  } = useEntitlement(analysisId, accessRefreshSignal, accessClaimChecked && !loading);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  const loadReport = useCallback(async () => {
    if (!analysisId) return null;
    const { data, error } = await supabase
      .from("analyses")
      .select("id, status, result_json, context_data, message_count, error_message, couple_type_id, relationship_type, is_paid, user_id")
      .eq("id", analysisId)
      .maybeSingle();

    if (error || !data) return null;
    return data as unknown as Row;
  }, [analysisId]);

  useEffect(() => {
    if (!analysisId) {
      navigate("/error?reason=not_found", { replace: true });
      return;
    }
    if (authLoading) return;
    let cancelled = false;
    setLoading(true);
    setAccessClaimChecked(false);
    (async () => {
      const claimResult = await claimPendingAnalysis();
      if (claimResult.attempted) {
        setAccessRefreshSignal((n) => n + 1);
      }
      // Also try session-matched claim: if the logged-in user's
      // chemistry_session_id matches the row's session_id and the row is
      // unowned, attach it. Covers the case where the user signed in
      // before opening the report (no pending_claim_analysis_id set).
      if (user?.id) {
        try {
          const { data: claimed } = await supabase.rpc(
            "claim_anonymous_analyses",
            { p_session_id: getSessionId(), p_user_id: user.id },
          );
          if (typeof claimed === "number" && claimed > 0) {
            setAccessRefreshSignal((n) => n + 1);
          }
        } catch {
          // non-fatal
        }
      }
      const data = await loadReport();
      if (cancelled) return;
      if (!data) {
        navigate("/error?reason=not_found", { replace: true });
        return;
      }
      if (data.status !== "complete" || !data.result_json) {
        navigate(`/processing/${analysisId}`, { replace: true });
        return;
      }
      setRow(data);
      setAccessClaimChecked(true);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisId, authLoading, loadReport, navigate, user?.id]);

  useEffect(() => {
    if (!row || loading || entitlementLoading || accessLoggedRef.current) return;
    accessLoggedRef.current = true;
    console.log("[report-access]", {
      authUserId: user?.id,
      analysisUserId: row.user_id,
      isOwner,
      hasPaidAccess: hasFullAccess,
      pendingClaim: localStorage.getItem("pending_claim_analysis_id"),
    });
  }, [row, loading, entitlementLoading, user?.id, isOwner, hasFullAccess]);

  // Show feedback modal when user scrolls near bottom of report, or after 90s — whichever first.
  useEffect(() => {
    if (!row || !analysisId) return;
    if (sessionStorage.getItem(`chemistry_feedback_shown_${analysisId}`)) return;

    let triggered = false;
    const trigger = (reason: "scroll" | "timeout") => {
      if (triggered) return;
      triggered = true;
      logEvent("feedback_shown", { skipped: false, trigger: reason });
      setShowFeedback(true);
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };

    const onScroll = () => {
      const el = reportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const distanceFromBottom = rect.bottom - window.innerHeight;
      if (distanceFromBottom <= 200) trigger("scroll");
    };

    const t = setTimeout(() => trigger("timeout"), 90_000);
    window.addEventListener("scroll", onScroll, { passive: true });
    // Check immediately in case the report is short enough to already be in view.
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, [row, analysisId]);

  const openFeedbackManually = () => {
    logEvent("feedback_shown", { skipped: false, trigger: "manual" });
    // Clear suppression flag so this explicit request always works,
    // even if the user previously dismissed it.
    if (analysisId) {
      sessionStorage.removeItem(`chemistry_feedback_shown_${analysisId}`);
    }
    setShowFeedback(true);
  };

  const result = row?.result_json ?? null;
  const context = (row?.context_data ?? null) as ContextData | null;

  const safetyMode = result?.meta?.safety_concern === true;
  const hasUnlockedReport = hasFullAccess || (isOwner && row?.is_paid === true);

  // ----- Checkout return handling -----
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (!checkout || !analysisId) return;

    if (checkout === "cancel") {
      toast("Checkout canceled — you can still unlock anytime.", { duration: 4000 });
      const next = new URLSearchParams(searchParams);
      next.delete("checkout");
      next.delete("session_id");
      setSearchParams(next, { replace: true });
      return;
    }

    if (checkout !== "success") return;

    const toastId = "checkout-unlock";
    const checkoutSessionId = searchParams.get("session_id");
    toast.loading("Payment successful — unlocking your full report…", { id: toastId });
    let elapsed = 0;
    const checkAccess = async () => {
      refreshEntitlement();
      if (user?.id) {
        try {
          await supabase.functions.invoke("sync-subscription", {
            body: { environment: getStripeEnvironment(), analysisId, sessionId: checkoutSessionId },
          });
          refreshEntitlement();
        } catch (e) {
          console.warn("subscription sync retry failed", e);
        }
      }
      const latest = await loadReport();
      if (latest?.is_paid) {
        setRow(latest);
      }
    };
    const interval = window.setInterval(() => {
      elapsed += 2000;
      void checkAccess();
      if (elapsed >= 120_000) {
        window.clearInterval(interval);
        toast.error(
          "Payment confirmed but unlock is still syncing. Please refresh in a moment or contact support.",
          { id: toastId },
        );
        logEvent("stripe_unlock_delay", { analysis_id: analysisId });
      }
    }, 2000);
    // Kick off the first refresh immediately.
    void checkAccess();
    return () => {
      window.clearInterval(interval);
      toast.dismiss(toastId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("checkout"), analysisId]);

  // When entitlement flips to true while polling, clear toast + URL.
  useEffect(() => {
    if (searchParams.get("checkout") !== "success") return;
    if (!hasUnlockedReport) return;
    toast.success("Unlocked. Enjoy your full report.", { id: "checkout-unlock", duration: 3000 });
    logEvent("entitlement_unlocked", { analysis_id: analysisId });
    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    next.delete("session_id");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnlockedReport]);

  const handleDownload = async () => {
    if (!cardRef.current || !context || downloading) return;
    setDownloading(true);
    try {
      // Wait for web fonts to be ready so text renders correctly.
      if (typeof document !== "undefined" && (document as Document & { fonts?: FontFaceSet }).fonts) {
        try {
          await (document as Document & { fonts: FontFaceSet }).fonts.ready;
        } catch {
          // ignore
        }
      }

      const node = cardRef.current;
      const rect = node.getBoundingClientRect();
      const captureWidth = Math.ceil(rect.width);
      const captureHeight = Math.ceil(rect.height);
      const dataUrl = await htmlToImage.toPng(node, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        skipFonts: false,
        width: captureWidth,
        height: captureHeight,
        style: {
          width: `${captureWidth}px`,
          height: `${captureHeight}px`,
          margin: "0",
          marginLeft: "0",
          marginRight: "0",
        },
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `chemistry-${sanitizeName(context.name1)}-${sanitizeName(context.name2)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      void supabase.from("share_clicks").insert([
        { analysis_id: analysisId!, platform: "download" },
      ]);
    } catch (e) {
      toast.error("Could not generate image.");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `https://couplechemistry.lovable.app/report/${analysisId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied", { duration: 2000 });
      void supabase.from("share_clicks").insert([
        { analysis_id: analysisId!, platform: "copy_link" },
      ]);
    } catch {
      toast.error("Could not copy link.");
    }
  };

  const handleShare = async () => {
    const url = `https://couplechemistry.lovable.app/report/${analysisId}`;
    const text = result
      ? `Our chemistry score: ${Math.round(result.headline.score)} — ${result.headline.tier_label}`
      : "Check our chemistry analysis";
    const canWebShare =
      typeof navigator !== "undefined" &&
      typeof (navigator as Navigator).share === "function";
    if (canWebShare) {
      try {
        await (navigator as Navigator).share({ title: "BetweenTheLines™ report", text, url });
        void supabase.from("share_clicks").insert([
          { analysis_id: analysisId!, platform: "web_share" },
        ]);
        return;
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string };
        // User cancelled the share sheet — do nothing.
        if (e?.name === "AbortError") return;
        // Otherwise (NotAllowedError in iframes, etc.) fall through to fallback.
        console.warn("navigator.share failed, falling back", e);
      }
    }
    // Fallback: open modal with copyable link (iOS-friendly when share is blocked).
    setCopied(false);
    setShareFallbackOpen(true);
  };

  const shareUrl = `https://couplechemistry.lovable.app/report/${analysisId}`;
  const shareText = result
    ? `Our chemistry score: ${Math.round(result.headline.score)} — ${result.headline.tier_label}`
    : "Check our chemistry analysis";

  const copyFromFallback = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast("Link copied", { duration: 2000 });
      void supabase.from("share_clicks").insert([
        { analysis_id: analysisId!, platform: "copy_link" },
      ]);
    } catch {
      // Last-resort: select text in the input so user can long-press copy.
      const input = document.getElementById("share-fallback-url") as HTMLInputElement | null;
      input?.select();
      toast.error("Couldn't copy automatically. Long-press the link to copy.");
    }
  };

  const openX = () => {
    const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(x, "_blank", "noopener,noreferrer");
    void supabase.from("share_clicks").insert([
      { analysis_id: analysisId!, platform: "x" },
    ]);
  };

  if (loading || !result || !context) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{`BetweenTheLines™ Report: ${context.name1} & ${context.name2} — ${Math.round(result.headline.score)}/100`}</title>
        <meta
          name="description"
          content={`Chemistry score ${Math.round(result.headline.score)} — ${result.headline.tier_label}. ${result.headline.vibe_summary}`.slice(0, 160)}
        />
        <link rel="canonical" href={`https://couplechemistry1.lovable.app/report/${analysisId}`} />
        <meta property="og:title" content={`Chemistry Score: ${Math.round(result.headline.score)}/100 — ${result.headline.tier_label}`} />
        <meta property="og:description" content={result.headline.vibe_summary} />
        <meta property="og:url" content={`https://couplechemistry1.lovable.app/report/${analysisId}`} />
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        {!safetyMode && (
          <div ref={reportRef}>
            {row?.couple_type_id != null && (
              <div className="mb-8">
                <CoupleTypeCard
                  coupleTypeId={row.couple_type_id}
                  relationshipType={(row.relationship_type as RelationshipType) || "romantic"}
                  size="full"
                />
              </div>
            )}
            <div data-pdf-section>
              <ShareableCard ref={cardRef} result={result} context={context} />
            </div>

            {/* Action buttons */}
            <div data-pdf-exclude="true" className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center sm:gap-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-[14px] font-medium hover:bg-muted"
              >
                <Download className="h-4 w-4" /> {downloading ? "Preparing image…" : "Download as image"}
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-[14px] font-medium hover:bg-muted"
              >
                <Copy className="h-4 w-4" /> Copy link
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-[14px] font-medium hover:bg-muted"
              >
                <Share2 className="h-4 w-4" /> Share…
              </button>
            </div>

            {!user && !isAnonymousOwner && analysisId && (
              <div data-pdf-exclude="true" className="mt-6 flex justify-center">
                <Link
                  to={`/auth?return_to=${encodeURIComponent(`/report/${analysisId}`)}`}
                  onClick={() =>
                    logEvent("signup_cta_clicked", {
                      source: "top_banner",
                      analysis_id: analysisId,
                    })
                  }
                  className="rounded-full bg-foreground px-6 py-3 text-[14px] font-medium text-background shadow-sm transition-opacity hover:opacity-90"
                >
                  Save this report — Free account
                </Link>
              </div>
            )}

            {result.meta.analysis_confidence === "low" && (
              <div data-pdf-section className="mt-8 flex items-start gap-3 rounded-xl bg-pastel-amber-bg p-4 text-pastel-amber-fg">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p className="text-[13px] leading-relaxed">
                  Low confidence: only {result.meta.messages_analyzed} messages were available.
                  Treat this as a snapshot, not a portrait of the relationship.
                </p>
              </div>
            )}

            <FreeInsights result={result} />

            {analysisId && (
              <div className="mt-12">
                {entitlementLoading ? (
                  <div className="py-12 text-center text-[14px] text-muted-foreground">
                    Loading access…
                  </div>
                ) : hasUnlockedReport ? (
                  <>
                    {isOwner && row?.is_paid === false && (
                      <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-pastel-green-bg px-3 py-1.5 text-[12px] font-medium text-pastel-green-fg-strong">
                        Unlocked by your subscription
                      </div>
                    )}
                    <DeepReport result={result} context={context} locked={false} />
                  </>
                ) : isOwner ? (
                  <PaywallBlur locked isOwner={isOwner} analysisId={analysisId}>
                    <DeepReport result={result} context={context} locked />
                  </PaywallBlur>
                ) : isAnonymousOwner ? (
                  <PaywallBlur locked isOwner={false} isAnonymousOwner analysisId={analysisId}>
                    <DeepReport result={result} context={context} locked />
                  </PaywallBlur>
                ) : (
                  <PaywallBlur locked isOwner={false} isAnonymousOwner={false} analysisId={analysisId}>
                    <DeepReport result={result} context={context} locked />
                  </PaywallBlur>
                )}
              </div>
            )}

            {/* Persistent feedback CTA */}
            <div data-pdf-exclude="true" className="mt-16 flex justify-center">
              <button
                type="button"
                onClick={openFeedbackManually}
                className="rounded-full border border-orange-200 bg-orange-100 px-5 py-2.5 text-[14px] font-medium text-orange-900 shadow-md transition-colors hover:bg-orange-500 hover:text-white hover:border-orange-500"
              >
                Give feedback
              </button>
            </div>

            {/* Try again */}
            <div data-pdf-exclude="true" className="mt-16 text-center">
              <p className="mb-6 text-[12px] text-muted-foreground">
                Your messages have been deleted from our servers. Only your analysis results are kept.
              </p>
              <h3 className="text-[24px] font-medium tracking-tight">
                Curious about another relationship?
              </h3>
              <p className="mt-2 text-[15px] text-muted-foreground">
                Run another analysis. It's still free during testing.
              </p>
              <Link
                to="/#input-section"
                className="mt-5 inline-flex w-full max-w-[280px] items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90"
              >
                Start a new analysis <ArrowRight className="h-4 w-4" />
              </Link>
              <InviteFriendsButton className="mt-4" />
            </div>
          </div>
        )}

        {safetyMode && <SafetyOverride note={result.meta.safety_note ?? ""} />}
      </main>

      {analysisId && (
        <FeedbackModal
          analysisId={analysisId}
          open={showFeedback}
          onClose={() => setShowFeedback(false)}
        />
      )}

      {analysisId && (
        <SaveReportModal
          open={showSave}
          onClose={() => setShowSave(false)}
          returnTo={`/report/${analysisId}`}
        />
      )}

      <Dialog open={shareFallbackOpen} onOpenChange={setShareFallbackOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share this report</DialogTitle>
            <DialogDescription>
              Copy the link and paste it anywhere — Messages, WhatsApp, email, or notes.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex items-center gap-2">
            <input
              id="share-fallback-url"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-border bg-muted px-3 py-2 text-[13px] text-foreground"
            />
            <button
              type="button"
              onClick={copyFromFallback}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-[13px] font-medium text-background hover:opacity-90"
            >
              <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-2 flex justify-between text-[13px]">
            <button
              type="button"
              onClick={openX}
              className="text-muted-foreground underline-offset-2 hover:underline"
            >
              Share on X
            </button>
            <button
              type="button"
              onClick={() => setShareFallbackOpen(false)}
              className="text-muted-foreground underline-offset-2 hover:underline"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SafetyOverride = ({ note }: { note: string }) => (
  <section className="mx-auto max-w-xl py-12 text-center">
    <h2 className="text-[26px] font-medium tracking-tight sm:text-[32px]">
      Your conversation included some signals worth pausing on.
    </h2>
    {note && <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">{note}</p>}
    <ul className="mt-8 space-y-2 text-left text-[14px]">
      <li>
        <span className="font-medium">National Domestic Violence Hotline:</span> 1-800-799-7233
      </li>
      <li>
        <a
          href="https://www.thehotline.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          thehotline.org
        </a>
      </li>
      <li>
        <a
          href="https://www.loveisrespect.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          loveisrespect.org
        </a>{" "}
        <span className="text-muted-foreground">— for younger people</span>
      </li>
    </ul>
    <Link to="/" className="mt-10 inline-block text-[13px] text-muted-foreground underline">
      Return to homepage
    </Link>
  </section>
);

const DeepReport = ({
  result,
  context,
  locked = false,
}: {
  result: AnalysisResult;
  context: ContextData;
  locked?: boolean;
}) => {
  const { name1, name2 } = context;
  const profile1 = result.attachment_profiles?.[name1];
  const profile2 = result.attachment_profiles?.[name2];

  const horsemen = result.four_horsemen;
  const horsemenList = useMemo(
    () =>
      [
        { key: "criticism", label: "Criticism", h: horsemen?.criticism },
        { key: "contempt", label: "Contempt", h: horsemen?.contempt },
        { key: "defensiveness", label: "Defensiveness", h: horsemen?.defensiveness },
        { key: "stonewalling", label: "Stonewalling", h: horsemen?.stonewalling },
      ] as const,
    [horsemen],
  );
  const anyPresent = horsemenList.some((x) => x.h?.present);

  return (
    <div className="mt-12">
      <div data-pdf-section>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          Your full report
        </p>
        <h2 className="mt-1 text-[26px] font-medium tracking-tight sm:text-[32px]">
          {name1} & {name2}
          {context.duration ? ` · ${context.duration} together` : ""}
        </h2>
      </div>

      {/* 1. Communication diagnostic */}
      <Section title="1 · Communication diagnostic" locked={locked}>
        <div data-pdf-section className="grid grid-cols-2 gap-3">
          <Tile label="Avg reply time" value={textFromUnknown(result.communication_diagnostic?.response_time_asymmetry)} />
          <Tile label="Conversations initiated" value={textFromUnknown(result.communication_diagnostic?.initiator_balance)} />
          <Tile label="Message length ratio" value={textFromUnknown(result.communication_diagnostic?.message_length_asymmetry)} />
          <Tile label="Questions asked" value={textFromUnknown(result.communication_diagnostic?.question_ratio)} />
        </div>
        <div data-pdf-section className="mt-4 rounded-xl bg-pastel-purple-bg p-4 text-pastel-purple-fg-strong">
          <p className="text-[14px] leading-relaxed">
            <span className="font-medium">Key observation:</span>{" "}
            {textFromUnknown(result.communication_diagnostic?.key_observation)}
          </p>
        </div>
      </Section>

      {/* 2. Attachment styles */}
      <Section title="2 · Attachment styles" locked={locked}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {profile1 && (
            <div data-pdf-section>
              <AttachmentCard name={name1} profile={profile1} />
            </div>
          )}
          {profile2 && (
            <div data-pdf-section>
              <AttachmentCard name={name2} profile={profile2} />
            </div>
          )}
        </div>
        <EvidenceQuotes
          name1={name1}
          name2={name2}
          profile1={profile1}
          profile2={profile2}
        />
        {result.compatibility_implication && (
          <p data-pdf-section className="mt-5 text-[15px] leading-relaxed text-foreground">
            {result.compatibility_implication}
          </p>
        )}
      </Section>

      {/* 3. Four Horsemen */}
      <Section title="3 · The Four Horsemen" locked={locked}>
        <div data-pdf-section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {horsemenList.map((x) => (
            <div
              key={x.key}
              className="rounded-xl border border-border bg-card p-3 text-center"
            >
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[12px]">
                {x.label}
              </div>
              <div
                className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  x.h?.present
                    ? "bg-pastel-pink-bg text-pastel-pink-fg"
                    : "bg-pastel-green-bg text-pastel-green-fg-strong"
                }`}
              >
                {x.h?.present ? "Present" : "Clear"}
              </div>
            </div>
          ))}
        </div>
        {anyPresent && (
          <div data-pdf-section className="mt-4 rounded-xl bg-muted p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Quoted evidence
            </div>
            <div className="mt-2 space-y-2">
              {horsemenList
                .filter((x) => x.h?.present && evidenceText(x.h))
                .map((x) => (
                  <div key={x.key} className="text-[13px] leading-relaxed">
                    <span className="font-semibold uppercase tracking-wide text-foreground">
                      {x.label}:
                    </span>{" "}
                    <span className="italic text-muted-foreground">
                      &quot;{evidenceText(x.h)}&quot;
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Section>

      {/* 4. Hidden pattern */}
      <Section title="4 · The hidden pattern" locked={locked}>
        <div data-pdf-section className="rounded-xl bg-pastel-purple-bg p-4 text-pastel-purple-fg-strong">
          <h4 className="text-[15px] font-semibold">{result.hidden_pattern?.title}</h4>
          <p className="mt-2 text-[14px] leading-relaxed">
            {result.hidden_pattern?.description}
          </p>
        </div>
      </Section>

      {/* 5. Bids for connection */}
      <BidsSection bids={result.bids_for_connection} locked={locked} />

      {/* 6. Love languages */}
      <LoveLanguagesSection languages={result.love_languages} locked={locked} />

      {/* 7. Yellow flags */}
      <FlagListSection
        title="7 · Things to watch"
        flags={result.yellow_flags}
        tone="amber"
        locked={locked}
      />

      {/* 8. Red flags */}
      <FlagListSection
        title="8 · Red flags"
        flags={result.red_flags}
        tone="red"
        locked={locked}
      />

      {/* 9. Conversation prompts */}
      <Section title="9 · Personalized prompts for this week" locked={locked}>
        <div className="space-y-3">
          {(result.conversation_prompts ?? []).map((p, i) => (
            <div
              key={i}
              data-pdf-section
              className="rounded-lg border-l-2 border-l-pastel-green-fg-strong bg-muted p-3"
            >
              <p className="text-[14px] italic leading-relaxed text-foreground">
                &quot;{textFromUnknown(p, "")}&quot;
              </p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};

const Section = ({
  title,
  children,
  locked = false,
}: {
  title: string;
  children: ReactNode;
  locked?: boolean;
}) => (
  <section data-pdf-section className="mt-10">
    <h3 data-pdf-section className="text-[18px] font-medium tracking-tight sm:text-[20px]">
      {title}
    </h3>
    <div
      className={`mt-4 ${locked ? "pointer-events-none select-none" : ""}`}
      style={locked ? { filter: "blur(8px)" } : undefined}
      aria-hidden={locked || undefined}
    >
      {children}
    </div>
  </section>
);

const Tile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-muted p-4">
    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <p className="mt-1.5 text-[14px] leading-snug text-foreground">{value}</p>
  </div>
);

const AttachmentCard = ({
  name,
  profile,
}: {
  name: string;
  profile: import("@/lib/analysis-types").AttachmentProfile;
}) => {
  const primary = profile.primary_style;
  const pillClass = STYLE_PILL[primary] ?? "bg-muted text-muted-foreground";

  // Top 3 dimensions sorted desc; ensure primary (if a dimension) is included.
  const entries = Object.entries(profile.scores ?? {}) as Array<
    [AttachmentDimension | string, number]
  >;
  entries.sort((a, b) => b[1] - a[1]);
  let top = entries.slice(0, 3);
  const primaryIsDimension =
    primary === "secure" ||
    primary === "anxious" ||
    primary === "avoidant" ||
    primary === "disorganized";
  if (primaryIsDimension && !top.find(([k]) => k === primary)) {
    const found = entries.find(([k]) => k === primary);
    if (found) top = [found, ...top.slice(0, 2)];
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-medium">{name}</div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${pillClass}`}>
          {primary}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {top.map(([dim, val]) => (
          <div key={dim} className="flex items-center gap-2">
            <span className="w-20 text-[12px] capitalize text-muted-foreground">{dim}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`absolute inset-y-0 left-0 ${
                  dim === primary
                    ? STYLE_BAR[dim] ?? "bg-foreground"
                    : "bg-muted-foreground/40"
                }`}
                style={{ width: `${Math.max(0, Math.min(100, val))}%` }}
              />
            </div>
            <span className="w-8 text-right text-[12px] tabular-nums text-foreground">
              {Math.round(val)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">
        Confidence: {profile.confidence}
      </p>
    </div>
  );
};

const EvidenceQuotes = ({
  name1,
  name2,
  profile1,
  profile2,
}: {
  name1: string;
  name2: string;
  profile1?: import("@/lib/analysis-types").AttachmentProfile;
  profile2?: import("@/lib/analysis-types").AttachmentProfile;
}) => {
  const nonSecureScore = (p?: import("@/lib/analysis-types").AttachmentProfile) => {
    if (!p) return -1;
    const { anxious = 0, avoidant = 0, disorganized = 0 } = p.scores ?? {};
    return Math.max(anxious, avoidant, disorganized);
  };

  const both =
    profile1?.primary_style === "secure" && profile2?.primary_style === "secure";

  const blocks: Array<{ name: string; quotes: string[] }> = [];
  if (both) {
    if (profile1?.evidence_quotes?.length)
      blocks.push({ name: name1, quotes: profile1.evidence_quotes });
    if (profile2?.evidence_quotes?.length)
      blocks.push({ name: name2, quotes: profile2.evidence_quotes });
  } else {
    const pick = nonSecureScore(profile1) >= nonSecureScore(profile2) ? profile1 : profile2;
    const pickName = pick === profile1 ? name1 : name2;
    if (pick?.evidence_quotes?.length)
      blocks.push({ name: pickName, quotes: pick.evidence_quotes });
  }

  if (blocks.length === 0) return null;

  return (
    <div className="mt-5 space-y-4">
      {blocks.map((b) => (
        <div key={b.name} data-pdf-section className="rounded-xl bg-muted p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Quoted evidence — {b.name}
          </div>
          <div className="mt-2 space-y-1">
            {b.quotes.map((q, i) => (
              <p key={i} className="text-[13px] italic leading-relaxed text-muted-foreground">
                "{q}"
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const Report = () => (
  <ReportErrorBoundary>
    <ReportContent />
  </ReportErrorBoundary>
);

export default Report;

// ----- Additional deep-report sections -----
const BidsSection = ({
  bids,
  locked = false,
}: {
  bids: AnalysisResult["bids_for_connection"] | undefined;
  locked?: boolean;
}) => {
  if (!bids) return null;
  const items = [
    { label: "Turned toward", value: bids.turned_toward_pct, tone: "bg-pastel-green-bg text-pastel-green-fg-strong" },
    { label: "Turned away", value: bids.turned_away_pct, tone: "bg-pastel-amber-bg text-pastel-amber-fg-strong" },
    { label: "Turned against", value: bids.turned_against_pct, tone: "bg-pastel-pink-bg text-pastel-pink-fg" },
  ].filter((x) => typeof x.value === "number");
  if (items.length === 0) return null;
  return (
    <section data-pdf-section className="mt-10">
      <h3 className="text-[18px] font-medium tracking-tight sm:text-[20px]">
        5 · Bids for connection
      </h3>
      <div
        className={`mt-4 grid grid-cols-3 gap-2 ${locked ? "pointer-events-none select-none" : ""}`}
        style={locked ? { filter: "blur(8px)" } : undefined}
        aria-hidden={locked || undefined}
      >
        {items.map((it) => (
          <div key={it.label} className={`rounded-xl p-3 text-center ${it.tone}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wide">{it.label}</div>
            <div className="mt-1 text-[22px] font-medium">{Math.round(it.value as number)}%</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const LoveLanguagesSection = ({
  languages,
  locked = false,
}: {
  languages: unknown;
  locked?: boolean;
}) => {
  if (!languages) return null;
  const ll = languages as {
    person1?: string;
    person2?: string;
    mismatch_note?: string;
    [k: string]: unknown;
  };
  if (!ll.person1 && !ll.person2 && !ll.mismatch_note) return null;
  return (
    <section data-pdf-section className="mt-10">
      <h3 className="text-[18px] font-medium tracking-tight sm:text-[20px]">
        6 · Love languages
      </h3>
      <div
        className={`mt-4 rounded-xl border border-border bg-card p-4 ${locked ? "pointer-events-none select-none" : ""}`}
        style={locked ? { filter: "blur(8px)" } : undefined}
        aria-hidden={locked || undefined}
      >
        {(ll.person1 || ll.person2) && (
          <div className="grid grid-cols-2 gap-3 text-[14px]">
            {ll.person1 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Person 1</div>
                <div className="mt-1">{ll.person1}</div>
              </div>
            )}
            {ll.person2 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Person 2</div>
                <div className="mt-1">{ll.person2}</div>
              </div>
            )}
          </div>
        )}
        {ll.mismatch_note && (
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
            {ll.mismatch_note}
          </p>
        )}
      </div>
    </section>
  );
};

const FlagListSection = ({
  title,
  flags,
  tone,
  skipFirst = false,
  locked = false,
}: {
  title: string;
  flags: import("@/lib/analysis-types").ReportFlag[] | undefined;
  tone: "amber" | "red";
  skipFirst?: boolean;
  locked?: boolean;
}) => {
  const list = (flags ?? []).slice(skipFirst ? 1 : 0);
  if (list.length === 0) return null;
  const wrap =
    tone === "red"
      ? "bg-pastel-pink-bg text-pastel-pink-fg"
      : "bg-pastel-amber-bg text-pastel-amber-fg-strong";
  return (
    <section data-pdf-section className="mt-10">
      <h3 className="text-[18px] font-medium tracking-tight sm:text-[20px]">{title}</h3>
      <div
        className={`mt-4 space-y-3 ${locked ? "pointer-events-none select-none" : ""}`}
        style={locked ? { filter: "blur(8px)" } : undefined}
        aria-hidden={locked || undefined}
      >
        {list.map((flag, i) => {
          const obj = typeof flag === "object" && flag ? (flag as { title?: string; description?: string; evidence?: string }) : null;
          const heading = obj?.title ?? (typeof flag === "string" ? null : null);
          const desc = obj?.description ?? (typeof flag === "string" ? flag : null);
          const ev = obj?.evidence ?? null;
          return (
            <div key={i} className={`rounded-xl p-4 ${wrap}`}>
              {heading && <h4 className="text-[15px] font-semibold">{heading}</h4>}
              {desc && <p className="mt-2 text-[14px] leading-relaxed">{desc}</p>}
              {ev && (
                <p className="mt-2 text-[13px] italic leading-relaxed opacity-80">
                  &quot;{ev}&quot;
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ----- Free-tier insights (visible to all viewers) -----
const firstSentence = (text: string): string => {
  if (!text) return "";
  const match = text.match(/^[^.!?]+[.!?]/);
  if (match) return match[0].replace(/[.!?]+$/, "") + "…";
  return text + "…";
};

const FreeInsights = ({ result }: { result: AnalysisResult }) => {
  const greenFlag = result.green_flags?.[0];
  const greenObj =
    typeof greenFlag === "object" && greenFlag
      ? (greenFlag as { title?: string; description?: string; evidence?: string })
      : null;
  const greenTitle = greenObj?.title ?? (typeof greenFlag === "string" ? "Green flag" : null);
  const greenDesc = greenObj?.description ?? (typeof greenFlag === "string" ? greenFlag : null);
  const greenEvidence = greenObj?.evidence ?? null;

  const hp = result.hidden_pattern;
  const teaser = hp?.description ? firstSentence(hp.description) : null;

  if (!greenTitle && !hp?.title) return null;

  return (
    <div className="mt-12 space-y-6">
      {(greenTitle || greenDesc) && (
        <section>
          <h3 className="text-[18px] font-medium tracking-tight sm:text-[20px]">
            What&apos;s working
          </h3>
          <div className="mt-3 rounded-xl bg-pastel-green-bg p-4 text-pastel-green-fg-strong">
            {greenTitle && <h4 className="text-[15px] font-semibold">{greenTitle}</h4>}
            {greenDesc && (
              <p className="mt-2 text-[14px] leading-relaxed">{greenDesc}</p>
            )}
            {greenEvidence && (
              <p className="mt-2 text-[13px] italic leading-relaxed opacity-80">
                &quot;{greenEvidence}&quot;
              </p>
            )}
          </div>
        </section>
      )}
      {hp?.title && teaser && (
        <section>
          <h3 className="text-[18px] font-medium tracking-tight sm:text-[20px]">
            The pattern hiding in plain sight
          </h3>
          <div className="mt-3 rounded-xl bg-pastel-purple-bg p-4 text-pastel-purple-fg-strong">
            <h4 className="text-[15px] font-semibold">{hp.title}</h4>
            <p className="mt-2 text-[14px] leading-relaxed">{teaser}</p>
          </div>
        </section>
      )}
    </div>
  );
};