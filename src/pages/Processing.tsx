import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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

const Processing = () => {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [showSlow, setShowSlow] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const stopped = useRef(false);

  useEffect(() => {
    const t = setInterval(
      () => setPhraseIdx((i) => (i + 1) % ROTATING_MESSAGES.length),
      5000,
    );
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!analysisId) {
      navigate(`/error?reason=${encodeURIComponent("not_found")}`, { replace: true });
      return;
    }

    let firstQuery = true;

    const poll = async () => {
      if (stopped.current) return;
      const { data, error } = await supabase
        .from("analyses")
        .select("status, error_message")
        .eq("id", analysisId)
        .maybeSingle();

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
        <Heart className="h-4 w-4 fill-foreground text-foreground" strokeWidth={0} />
        <span className="text-[14px] font-medium tracking-tight">betweenthelines.app</span>
      </div>

      <img
        key={`gif-${phraseIdx}`}
        src={ROTATING_MESSAGES[phraseIdx].gif}
        alt=""
        aria-hidden="true"
        width={80}
        height={80}
        className="mt-10 h-20 w-20 animate-in fade-in duration-700"
      />

      <h1 className="mt-10 text-[28px] font-medium tracking-tight sm:text-[36px]">
        Reading the conversation…
      </h1>

      <p
        key={phraseIdx}
        className="mt-6 animate-in fade-in text-[16px] text-muted-foreground duration-700 sm:text-[18px]"
      >
        {ROTATING_MESSAGES[phraseIdx].text}
      </p>

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

      {/* Preload remaining GIFs so swaps are instant */}
      <div aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
        {ROTATING_MESSAGES.map((m, i) => (
          <img key={i} src={m.gif} alt="" width={1} height={1} />
        ))}
      </div>
    </div>
  );
};

export default Processing;