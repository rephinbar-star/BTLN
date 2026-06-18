import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import logoAsset from "@/assets/logo.png.asset.json";
import readingGif from "@/assets/processing/reading.gif.asset.json";
import patternsGif from "@/assets/processing/patterns.gif.asset.json";
import attachmentGif from "@/assets/processing/attachment.gif.asset.json";
import horsemenGif from "@/assets/processing/horsemen.gif.asset.json";
import hiddenGif from "@/assets/processing/hidden.gif.asset.json";
import almostGif from "@/assets/processing/almost.gif.asset.json";

const ROTATING_MESSAGES: { text: string; gif: string }[] = [
  { text: "Reading the messages…", gif: readingGif.url },
  { text: "Looking for patterns…", gif: patternsGif.url },
  { text: "Checking attachment styles…", gif: attachmentGif.url },
  { text: "Listening for the Four Horsemen…", gif: horsemenGif.url },
  { text: "Finding the hidden patterns…", gif: hiddenGif.url },
  { text: "Almost there…", gif: almostGif.url },
];

const POLL_INTERVAL_MS = 2000;
const SLOW_THRESHOLD_MS = 180_000;
const TIMEOUT_MS = 240_000;
const GIF_LOAD_TIMEOUT_MS = 10_000;
const MAX_GIF_RETRIES = 2;

const Processing = () => {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [showSlow, setShowSlow] = useState(false);
  const [loadedGifs, setLoadedGifs] = useState<Set<number>>(() => new Set());
  const [failedGifs, setFailedGifs] = useState<Set<number>>(() => new Set());
  const [retryNonce, setRetryNonce] = useState(0);
  const retriesRef = useRef<Record<number, number>>({});
  const startedAt = useRef<number>(Date.now());
  const stopped = useRef(false);

  // Preload all GIFs up front, track readiness, and apply a per-GIF timeout
  useEffect(() => {
    const imgs: HTMLImageElement[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    ROTATING_MESSAGES.forEach((m, i) => {
      if (loadedGifs.has(i)) return;
      const img = new Image();
      const markLoaded = () => {
        clearTimeout(timer);
        setLoadedGifs((prev) => {
          if (prev.has(i)) return prev;
          const next = new Set(prev);
          next.add(i);
          return next;
        });
        setFailedGifs((prev) => {
          if (!prev.has(i)) return prev;
          const next = new Set(prev);
          next.delete(i);
          return next;
        });
      };
      const markFailed = () => {
        clearTimeout(timer);
        img.src = "";
        setFailedGifs((prev) => {
          if (prev.has(i)) return prev;
          const next = new Set(prev);
          next.add(i);
          return next;
        });
      };
      img.onload = markLoaded;
      img.onerror = markFailed;
      const timer = setTimeout(markFailed, GIF_LOAD_TIMEOUT_MS);
      timers.push(timer);
      // cache-bust on retries so a stuck/broken cache entry is bypassed
      const retryN = retriesRef.current[i] ?? 0;
      img.src = retryN > 0 ? `${m.gif}${m.gif.includes("?") ? "&" : "?"}r=${retryN}` : m.gif;
      imgs.push(img);
    });
    return () => {
      timers.forEach((t) => clearTimeout(t));
      imgs.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryNonce]);

  const handleRetryGifs = () => {
    failedGifs.forEach((i) => {
      retriesRef.current[i] = (retriesRef.current[i] ?? 0) + 1;
    });
    setFailedGifs(new Set());
    setRetryNonce((n) => n + 1);
  };

  const currentFailed = failedGifs.has(phraseIdx) && !loadedGifs.has(phraseIdx);
  const retriesUsed = retriesRef.current[phraseIdx] ?? 0;
  const canRetryGif = currentFailed && retriesUsed < MAX_GIF_RETRIES;

  useEffect(() => {
    const t = setInterval(
      () =>
        setPhraseIdx((i) => {
          if (i >= ROTATING_MESSAGES.length - 1) return i;
          // Only advance if the next GIF has finished loading
          return loadedGifs.has(i + 1) ? i + 1 : i;
        }),
      8000,
    );
    return () => clearInterval(t);
  }, [loadedGifs]);

  useEffect(() => {
    if (!analysisId) {
      navigate(`/error?reason=${encodeURIComponent("not_found")}`, { replace: true });
      return;
    }

    let firstQuery = true;

    const poll = async () => {
      if (stopped.current) return;
      const { data: rows, error } = await supabase.rpc("get_analysis_for_session", {
        p_id: analysisId,
        p_session_id: getSessionId(),
      });
      const data = Array.isArray(rows) ? rows[0] : rows;

      if (error || !data) {
        if (firstQuery) {
          stopped.current = true;
          navigate(`/error?reason=${encodeURIComponent("not_found")}`, { replace: true });
          return;
        }
        // transient — keep polling
        firstQuery = false;
        return;
      }
      firstQuery = false;

      if (data.status === "complete") {
        stopped.current = true;
        navigate(`/report/${analysisId}`, { replace: true });
        return;
      }
      if (data.status === "failed") {
        stopped.current = true;
        const reason = data.error_message ?? "Analysis failed.";
        navigate(`/error?reason=${encodeURIComponent(reason)}`, { replace: true });
        return;
      }

      const elapsed = Date.now() - startedAt.current;
      if (elapsed > TIMEOUT_MS) {
        stopped.current = true;
        navigate(`/error?reason=${encodeURIComponent("timeout")}`, { replace: true });
        return;
      }
      if (elapsed > SLOW_THRESHOLD_MS) {
        setShowSlow(true);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      stopped.current = true;
      clearInterval(interval);
    };
  }, [analysisId, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="flex items-center gap-2">
        <img src={logoAsset.url} alt="BetweenTheLines™" className="h-8 w-auto" />
      </div>

      <img
        key={`gif-${phraseIdx}`}
        src={ROTATING_MESSAGES[phraseIdx].gif}
        alt=""
        aria-hidden="true"
        width={80}
        height={80}
        className="mt-10 h-20 w-20 animate-in fade-in duration-700"
        style={{ visibility: loadedGifs.has(phraseIdx) ? "visible" : "hidden" }}
      />

      {currentFailed && (
        <div className="mt-4 flex max-w-md flex-col items-center gap-2">
          <p className="text-[13px] text-pastel-amber-fg-strong">
            Couldn't load this step's animation.
          </p>
          {canRetryGif ? (
            <button
              type="button"
              onClick={handleRetryGifs}
              className="rounded-md border border-foreground/20 bg-background px-3 py-1 text-[13px] font-medium tracking-tight hover:bg-foreground/5"
            >
              Retry
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                navigate(`/error?reason=${encodeURIComponent("asset_unavailable")}`, { replace: true })
              }
              className="rounded-md border border-foreground/20 bg-background px-3 py-1 text-[13px] font-medium tracking-tight hover:bg-foreground/5"
            >
              Continue
            </button>
          )}
        </div>
      )}

      <h2
        key={`stage-${phraseIdx}`}
        className="mt-6 animate-in fade-in text-[24px] font-medium tracking-tight duration-700 sm:text-[32px]"
      >
        {ROTATING_MESSAGES[phraseIdx].text}
      </h2>

      <h3 className="mt-3 text-[14px] font-medium tracking-tight text-muted-foreground sm:text-[16px]">
        Reading Between The Lines
      </h3>

      <div className="mt-8 flex items-center gap-2" aria-label="loading">
        <span className="h-2 w-2 animate-pulse rounded-full bg-foreground/60 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-foreground/60 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-foreground/60" />
      </div>

      <p className="mt-10 max-w-md text-[12px] leading-relaxed text-muted-foreground">
        This usually takes 30–90 seconds. Don't refresh. Your messages will be deleted as soon as the analysis is done.
      </p>

      {showSlow && (
        <p className="mt-4 max-w-md text-[13px] text-pastel-amber-fg-strong">
          Taking longer than expected… still working.
        </p>
      )}

    </div>
  );
};

export default Processing;