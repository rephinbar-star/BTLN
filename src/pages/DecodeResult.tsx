import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AlertTriangle, ArrowRight, Check, Copy, Heart, Loader2, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useDecodeAccess, FREE_DECODES } from "@/hooks/useDecodeAccess";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { Button } from "@/components/ui/button";
import { getStripeEnvironment } from "@/lib/stripe";
import { Header } from "@/components/chemistry/Header";
import { NextSteps } from "@/components/results/NextSteps";
import { PrimeOffer } from "@/components/prime/PrimeOffer";
import { InteractiveModePanel } from "@/components/interactive/InteractiveModePanel";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { FeedbackControl } from "@/components/feedback/FeedbackControl";


const DECODE_PLAN_PRICE_ID = "BTLN_decode_monthly";

const POLL_MS = 2000;
const TIMEOUT_MS = 120_000;

type ReplyOption = { tone?: string; text?: string };
type DecodeResultJson = {
  verdict?: string;
  read?: string;
  signals?: string[];
  flag?: { type?: string | null; note?: string | null } | null;
  reply_options?: ReplyOption[];
  confidence?: string;
  _access_locked?: boolean;
};

const ReplyCard = ({
  option,
  index,
  decodeId,
}: {
  option: ReplyOption;
  index: number;
  decodeId: string;
}) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const text = option.text ?? "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    track("decode_reply_copied", { tone: option.tone ?? "unknown" });
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div
      className={`group w-full rounded-xl border bg-card p-4 text-left transition-all ${
        copied ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {option.tone ?? "Reply"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-2 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-prism-emerald-text" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <p className="mt-2 text-[16px] leading-relaxed text-foreground">{option.text}</p>
      <div className="mt-2 flex justify-end">
        <FeedbackControl
          compact
          label={`reply option ${index + 1}${option.tone ? ` (${option.tone})` : ""}`}
          target={{
            sourceKind: "quick_take",
            sourceId: decodeId,
            targetKind: "reply_option",
            targetKey: `reply_${index + 1}`,
          }}
        />
      </div>
    </div>
  );
};


const MANIPULATION_TYPES = [
  "gaslighting",
  "manipulation",
  "love_bombing",
  "guilt_trip",
  "stonewalling",
];

const DecodeResult = () => {
  const { decodeId } = useParams<{ decodeId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<string>("pending");
  const [result, setResult] = useState<DecodeResultJson | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const stopped = useRef(false);
  const startedAt = useRef(Date.now());
  const { user } = useAuth();
  const { entitled, completedCount, isLoading: accessLoading, refresh: refreshAccess } =
    useDecodeAccess();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [accessVersion, setAccessVersion] = useState(0);
  const paymentTracked = useRef(false);
  const { openCheckout, checkoutElement, isOpen, closeCheckout } = useStripeCheckout();
  const paywallTracked = useRef(false);
  const resumeTried = useRef(false);
  const pollingUnlock = useRef(false);

  useEffect(() => {
    if (!decodeId) return;
    stopped.current = false;

    const poll = async () => {
      if (stopped.current) return;
      const { data } = await supabase.rpc("get_decode_for_session", {
        p_id: decodeId,
        p_session_id: getSessionId(),
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        if (Date.now() - startedAt.current > TIMEOUT_MS) {
          stopped.current = true;
          setStatus("failed");
          setErrorMsg("We couldn't find this take.");
        }
        return;
      }
      setStatus(row.status);
      if (row.status === "complete") {
        stopped.current = true;
        const json = (row.result_json ?? {}) as DecodeResultJson;
        setResult(json);
        track("decode_completed", {
          has_flag: json.flag?.type != null,
          confidence: json.confidence ?? "unknown",
        });
        refreshAccess();
      } else if (row.status === "failed") {
        stopped.current = true;
        setErrorMsg(row.error_message ?? "That one didn't work out.");
      } else if (Date.now() - startedAt.current > TIMEOUT_MS) {
        stopped.current = true;
        setStatus("failed");
        setErrorMsg("This is taking longer than expected. Please try again.");
      }
    };

    void poll();
    const t = setInterval(poll, POLL_MS);
    return () => {
      stopped.current = true;
      clearInterval(t);
    };
  }, [decodeId, refreshAccess, accessVersion, user?.id]);

  const flagType = result?.flag?.type ?? null;
  const isSafety = flagType === "safety";
  const isManipulation = !!flagType && MANIPULATION_TYPES.includes(String(flagType));
  const replies = isSafety ? [] : (result?.reply_options ?? []);

  // First-free metering: any active subscription = unlimited decodes.
  const locked =
    status === "complete" && result?._access_locked === true;

  useEffect(() => {
    if (locked && !paywallTracked.current) {
      paywallTracked.current = true;
      track("decode_paywall_viewed", {} as never);
    }
  }, [locked]);

  const startDecodeCheckout = useCallback(async (purchase: "single" | "monthly" = "monthly") => {
    if (!decodeId) return;
    setCheckoutError(null);
    track("decode_intent_to_pay_click", { plan: purchase === "single" ? "one_time" : "decode_monthly" });
    if (!user?.id) {
      navigate("/auth?return_to=" + encodeURIComponent(`/decode/${decodeId}?intent=${purchase === "single" ? "decode_single" : "decode_upgrade"}`));
      return;
    }
    const { data: claimed, error } = await supabase.rpc("claim_decode_for_session", { p_id: decodeId, p_session_id: getSessionId() });
    if (error || !claimed) { setCheckoutError("We could not confirm this take belongs to you. Please return to your take and retry."); return; }
    openCheckout({ priceId: purchase === "single" ? "BTLN_report_unlock" : DECODE_PLAN_PRICE_ID,
      ...(purchase === "single" ? { decodeId, reportKind: "quick_take" as const } : {}),
      customerEmail: user.email, userId: user.id,
      returnUrl: `${window.location.origin}/decode/${decodeId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    });
  }, [user?.id, user?.email, decodeId, navigate, openCheckout]);

  useEffect(() => {
    const intent = searchParams.get("intent");
    if (resumeTried.current || !user?.id || (intent !== "decode_single" && intent !== "decode_upgrade")) return;
    resumeTried.current = true;
    void startDecodeCheckout(intent === "decode_single" ? "single" : "monthly");
  }, [searchParams, user?.id, startDecodeCheckout]);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (searchParams.get("checkout") !== "success" || !sessionId || !user?.id || !decodeId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      const { data: confirmation, error } = await supabase.functions.invoke("sync-subscription", { body: { sessionId, decodeId, environment: getStripeEnvironment() } });
      if (cancelled) return;
      setAccessVersion((version) => version + 1);
      refreshAccess();
      if (!error && confirmation?.paymentVerified === true) {
        if (!paymentTracked.current) { paymentTracked.current = true; track("payment_made", { target_id: decodeId, target_type: "quick_take" }); }
        const next = new URLSearchParams(searchParams); next.delete("checkout"); next.delete("session_id"); next.delete("intent");
        setSearchParams(next, { replace: true });
      } else if (attempts < 20) timer = setTimeout(tick, 1500);
      else setCheckoutError("Your payment is still being confirmed. This take stays locked until secure confirmation arrives. Please check again shortly.");
    };
    void tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [searchParams, user?.id, decodeId, refreshAccess, setSearchParams]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Quick Take — BetweenTheLines™</title>
        <meta name="description" content="What that text actually means — our quick take, in seconds." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <Header />
      <FeedbackProvider sourceKind="quick_take" sourceId={decodeId}>
      <main className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        {status !== "complete" && status !== "failed" && (
          <div className="flex flex-col items-center py-20 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <h1 className="mt-6 text-[22px] font-medium tracking-tight">Reading between the lines…</h1>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Give us a few seconds. This is usually quick.
            </p>
          </div>
        )}

        {status === "failed" && (
          <div className="py-20 text-center">
            <h1 className="text-[22px] font-medium tracking-tight">That didn't work</h1>
            <p className="mt-2 text-[14px] text-muted-foreground">{errorMsg}</p>
            <Link
               to="/quick"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background"
            >
              Try again <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {status === "complete" && result && (
          <div className="animate-fade-in">
            <h1 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Here&apos;s our take
            </h1>
            <p className="mt-3 text-[28px] font-semibold leading-[1.15] tracking-tight sm:text-[36px]">
              {result.verdict}
            </p>
            {result.read && (
              <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">{result.read}</p>
            )}

            {decodeId && (
              <div className="mt-4 flex justify-end">
                <FeedbackControl
                  label="this Quick Take"
                  target={{
                    sourceKind: "quick_take",
                    sourceId: decodeId,
                    targetKind: "overall",
                    targetKey: "main",
                  }}
                />
              </div>
            )}


            {!!result.signals?.length && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {result.signals.map((s) => (
                  <li
                    key={s}
                    className="rounded-full border border-border bg-muted/40 px-3 py-1 text-[12px] font-medium text-muted-foreground"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}

            {flagType && (
              <div
                className={`mt-7 rounded-xl border p-4 ${
                  isSafety
                    ? "border-prism-cyan/50 bg-prism-cyan/10 text-foreground"
                    : "border-prism-amber/50 bg-pastel-amber-bg text-pastel-amber-fg"
                }`}
                role="note"
              >
                <div className="flex items-start gap-3">
                  {isSafety ? (
                    <Heart className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-[14px] font-semibold">
                      {isSafety
                        ? "This one matters more than a clever reply"
                        : isManipulation
                          ? `Heads up: ${String(flagType).replace(/_/g, " ")}`
                          : "Worth noticing"}
                    </p>
                    {result.flag?.note && (
                      <p className="mt-1 text-[14px] leading-relaxed">{result.flag.note}</p>
                    )}
                    {isSafety && (
                      <p className="mt-2 text-[14px] leading-relaxed">
                        You deserve to feel safe. Talking this through with someone you trust — a friend,
                        family member, or a support line in your country — is a good next step.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(replies.length > 0 || locked) && (
              <section className="mt-9">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  How you could reply
                </h2>
                <div className="relative mt-3">
                  <div
                    className="space-y-3"
                    aria-hidden={locked}
                  >
                    {replies.map((o, i) => (
                      <ReplyCard
                        key={`${o.tone ?? "reply"}-${i}`}
                        option={o}
                        index={i}
                        decodeId={decodeId ?? ""}
                      />
                    ))}

                  </div>

                  {locked && (
                    <div className="flex items-center justify-center py-2">
                      <div className="w-full max-w-md rounded-2xl border border-border bg-card/95 p-6 text-center shadow-xl backdrop-blur">
                        <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
                        <h3 className="mt-3 text-[18px] font-semibold tracking-tight">
                          Your free Quick Take is used up
                        </h3>
                        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                          Unlock this one session for $4.99, or subscribe for unlimited Quick Takes
                          and Interactive Mode at $6.99/month.
                        </p>
                        <Button onClick={() => void startDecodeCheckout("single")} className="mt-4 min-h-11 w-full">Unlock this session — $4.99</Button>
                        <Button onClick={() => void startDecodeCheckout("monthly")} variant="outline" className="mt-3 min-h-11 h-auto w-full whitespace-normal py-3">Quick Take + Interactive Mode — $6.99/month</Button>
                        <p className="mt-3 text-[13px] text-muted-foreground">Monthly plan: cancel anytime. Single session: no subscription or Interactive Mode.</p>
                        <PrimeOffer className="mt-4 text-left" returnTo={`/decode/${decodeId}`} />
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {checkoutError && <p role="alert" className="mt-4 text-sm text-destructive">{checkoutError}</p>}
            {isOpen && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-4 backdrop-blur">
                <div className="mx-auto mt-6 max-w-2xl">
                  <button
                    type="button"
                    onClick={closeCheckout}
                    className="mb-4 text-[14px] text-muted-foreground hover:text-foreground"
                  >
                    ← Back to your take
                  </button>
                  {checkoutElement}
                </div>
              </div>
            )}

            {user && decodeId && <InteractiveModePanel decodeId={decodeId} />}

            {user && (
               <div className="mt-8 text-center">
                <Link
                  to="/account"
                  className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Manage subscription
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
      </FeedbackProvider>
       {status === "complete" && result && <NextSteps mode="quick" safety={isSafety} />}
    </div>
  );
};

export default DecodeResult;