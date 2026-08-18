import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AlertTriangle, ArrowRight, Check, Copy, Heart, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { track } from "@/lib/analytics";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";

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
};

const ReplyCard = ({ option }: { option: ReplyOption }) => {
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
    <button
      type="button"
      onClick={copy}
      className={`group w-full rounded-xl border bg-card p-4 text-left transition-all active:scale-[0.99] ${
        copied ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-border hover:border-foreground/40"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {option.tone ?? "Reply"}
        </span>
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground group-hover:text-foreground">
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </span>
      </div>
      <p className="mt-2 text-[16px] leading-relaxed text-foreground">{option.text}</p>
    </button>
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
  const [status, setStatus] = useState<string>("pending");
  const [result, setResult] = useState<DecodeResultJson | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const stopped = useRef(false);
  const startedAt = useRef(Date.now());

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
          setErrorMsg("We couldn't find this decode.");
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
      } else if (row.status === "failed") {
        stopped.current = true;
        setErrorMsg(row.error_message ?? "That decode didn't work out.");
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
  }, [decodeId]);

  const flagType = result?.flag?.type ?? null;
  const isSafety = flagType === "safety";
  const isManipulation = !!flagType && MANIPULATION_TYPES.includes(String(flagType));
  const replies = isSafety ? [] : (result?.reply_options ?? []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Quick Decode — BetweenTheLines™</title>
        <meta name="description" content="What that text actually means, decoded in seconds." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <Header />
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
              to="/"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background"
            >
              Try again <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {status === "complete" && result && (
          <div className="animate-fade-in">
            <h1 className="text-[28px] font-semibold leading-[1.15] tracking-tight sm:text-[36px]">
              {result.verdict}
            </h1>
            {result.read && (
              <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">{result.read}</p>
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
                    ? "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
                    : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
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

            {replies.length > 0 && (
              <section className="mt-9">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  How you could reply
                </h2>
                <div className="mt-3 space-y-3">
                  {replies.map((o, i) => (
                    <ReplyCard key={`${o.tone ?? "reply"}-${i}`} option={o} />
                  ))}
                </div>
              </section>
            )}

            <div className="mt-12 rounded-xl border border-border bg-muted/30 p-5">
              <p className="text-[15px] font-medium">Want the full read on you two?</p>
              <p className="mt-1 text-[14px] text-muted-foreground">
                Upload a longer conversation and get the deep report — patterns, attachment styles, and
                what keeps repeating.
              </p>
              <Link
                to="/#input-section"
                className="mt-4 inline-flex items-center gap-2 text-[14px] font-medium underline-offset-4 hover:underline"
              >
                Run the full analysis <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 text-center">
              <Link to="/" className="text-[14px] text-muted-foreground hover:text-foreground">
                Decode another text →
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default DecodeResult;