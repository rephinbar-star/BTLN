import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/session";

type Props = {
  analysisId: string;
  open: boolean;
  onClose: () => void;
};

export const FeedbackModal = ({ analysisId, open, onClose }: Props) => {
  const [score, setScore] = useState(5);
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const close = () => {
    sessionStorage.setItem(`chemistry_feedback_shown_${analysisId}`, "1");
    onClose();
  };

  const handleSkip = () => {
    logEvent("feedback_shown", { skipped: true });
    close();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await supabase.rpc("submit_feedback", {
        p_analysis_id: analysisId,
        p_score: score,
        p_text: text.trim() || null,
        p_email: email.trim() || null,
      });
      if (email.trim()) {
        const { getSessionId } = await import("@/lib/session");
        await supabase.rpc("capture_email", {
          p_email: email.trim(),
          p_analysis_id: analysisId,
          p_source: "feedback_modal",
          p_session_id: getSessionId(),
        });
      }
      logEvent("feedback_submitted", {
        score,
        has_text: text.trim().length > 0,
        has_email: email.trim().length > 0,
      });
      toast("Thanks. Your feedback helps.");
      close();
    } catch (err) {
      toast.error("Could not save feedback.");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
      onClick={handleSkip}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full animate-in slide-in-from-bottom-4 fade-in duration-300 mx-4 mb-4 max-w-lg rounded-2xl bg-card p-6 shadow-[var(--shadow-card)] sm:mb-0 sm:mx-0 sm:p-7"
      >
        <button
          type="button"
          onClick={handleSkip}
          aria-label="Close"
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="text-[20px] font-medium tracking-tight">How accurate did this feel?</h3>

        <div className="mt-6 text-center">
          <div className="text-[32px] font-medium leading-none">{score}</div>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="mt-3 w-full accent-foreground"
        />
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>Way off</span>
          <span>Scary accurate</span>
        </div>

        <div className="mt-5">
          <label className="text-[13px] font-medium text-foreground">
            Anything we got really right or really wrong? (optional)
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-3 text-[14px] focus:border-foreground focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <label className="text-[13px] font-medium text-foreground">
            Want updates as we improve this? (optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-3 text-[14px] focus:border-foreground focus:outline-none"
          />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-full px-5 py-2.5 text-[14px] font-medium text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-full bg-foreground px-5 py-2.5 text-[14px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Submit feedback"}
          </button>
        </div>
      </div>
    </div>
  );
};