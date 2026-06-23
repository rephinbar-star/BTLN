import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/session";

type Props = {
  analysisId?: string;
  open: boolean;
  onClose: () => void;
};

export const FeedbackModal = ({ analysisId, open, onClose }: Props) => {
  const [score, setScore] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const close = () => {
    if (analysisId) {
      sessionStorage.setItem(`chemistry_feedback_shown_${analysisId}`, "1");
    }
    onClose();
  };

  const handleSkip = () => {
    logEvent("feedback_shown", { skipped: true, has_analysis_id: !!analysisId });
    close();
  };

  const handleSubmit = async () => {
    if (score === null) return;
    setSubmitting(true);
    const questionVariant: "wrong" | "balanced" = score <= 3 ? "wrong" : "balanced";
    try {
      if (analysisId) {
        await supabase.rpc("submit_feedback", {
          p_analysis_id: analysisId,
          p_score: score,
          p_text: text.trim() || null,
          p_email: email.trim() || null,
          p_question_variant: questionVariant,
        });
      } else {
        await (supabase as any).from("general_feedback").insert([
          {
            score,
            text: text.trim() || null,
            email: email.trim() || null,
            source: "footer",
            question_variant: questionVariant,
          },
        ]);
      }

      if (email.trim()) {
        const { getSessionId } = await import("@/lib/session");
        await supabase.rpc("capture_email", {
          p_email: email.trim(),
          p_analysis_id: analysisId || null,
          p_source: analysisId ? "feedback_modal" : "footer_feedback",
          p_session_id: getSessionId(),
        });
      }

      logEvent("feedback_submitted", {
        score,
        question_variant: questionVariant,
        has_text: text.trim().length > 0,
        has_email: email.trim().length > 0,
        has_analysis_id: !!analysisId,
      });
      toast("Thanks. Your feedback helps.");
      close();
    } catch (err) {
      toast.error("Could not save feedback.");
      setSubmitting(false);
    }
  };

  const variant: "wrong" | "balanced" = score !== null && score <= 3 ? "wrong" : "balanced";
  const textLabel =
    variant === "wrong"
      ? "What did we get wrong? (optional)"
      : "Anything we got really right or really wrong? (optional)";
  const textPlaceholder = variant === "wrong" ? "The part that missed was…" : "";

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
        <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
          You're one of our first testers — your honest take, especially the critical bits, shapes what we build next.
        </p>

        <div className="mt-6 text-center">
          <div className="text-[32px] font-medium leading-none">
            {score === null ? <span className="text-muted-foreground">–</span> : score}
          </div>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={score ?? 5}
          onChange={(e) => setScore(Number(e.target.value))}
          className="mt-3 w-full accent-foreground"
        />
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>Way off</span>
          <span>Scary accurate</span>
        </div>

        <div className="mt-5">
          <label className="text-[13px] font-medium text-foreground">
            {textLabel}
          </label>
          <p className="mt-1 text-[13px] text-muted-foreground">
            What could we do better/improve?
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={textPlaceholder}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-3 text-[14px] focus:border-foreground focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <label className="text-[13px] font-medium text-foreground">
            Want a say in where this goes? Drop your email for early updates (optional).
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
            disabled={submitting || score === null}
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
