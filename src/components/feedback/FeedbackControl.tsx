import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFeedbackStore } from "./FeedbackProvider";
import {
  CORRECTION_REASON_CODES,
  reasonChipsFor,
  type FeedbackRating,
  type FeedbackTarget,
} from "@/lib/feedback/types";

/** Source is inherited from the surrounding FeedbackProvider unless overridden. */
export type FeedbackTargetInput = Omit<FeedbackTarget, "sourceKind" | "sourceId"> &
  Partial<Pick<FeedbackTarget, "sourceKind" | "sourceId">>;

type Props = {
  target: FeedbackTargetInput;
  /** Compact renders icons only (used next to reply options and inline items). */
  compact?: boolean;
  /** Accessible description of what is being rated, e.g. "reply option 2". */
  label: string;
  /** Offered when the person says the read misread a speaker or missed context. */
  onCorrectionRequested?: () => void;
  className?: string;
};

const CHIP =
  "rounded-full border border-border px-3 py-1.5 text-[13px] leading-none transition-colors min-h-[36px] inline-flex items-center";

export const FeedbackControl = ({
  target: targetInput,
  compact = false,
  label,
  onCorrectionRequested,
  className,
}: Props) => {
  const store = useFeedbackStore();
  const target: FeedbackTarget = {
    ...targetInput,
    sourceKind: targetInput.sourceKind ?? store?.sourceKind ?? "quick_take",
    sourceId: targetInput.sourceId ?? store?.sourceId ?? "",
  };
  const existing = store?.get(target.targetKind, target.targetKey ?? "main");
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"rate" | "details">("rate");
  const [rating, setRating] = useState<FeedbackRating | null>(existing?.rating ?? null);
  const [reasons, setReasons] = useState<string[]>(existing?.reasonCodes ?? []);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!existing) return;
    setRating(existing.rating);
    setReasons(existing.reasonCodes);
    setComment(existing.comment ?? "");
  }, [existing?.rating, existing?.reasonCodes, existing?.comment]);

  const chips = useMemo(
    () => (rating ? reasonChipsFor(rating, target) : []),
    [rating, target],
  );

  const showCorrection =
    !!onCorrectionRequested && reasons.some((code) => CORRECTION_REASON_CODES.has(code));

  if (!store || !target.sourceId) return null;

  const closeAndReturnFocus = () => {
    setOpen(false);
    setStage("rate");
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  const rate = async (next: FeedbackRating) => {
    // One tap records the rating. Details stay optional.
    if (rating === next) {
      setRating(null);
      setReasons([]);
      await store.clear(target);
      closeAndReturnFocus();
      return;
    }
    setRating(next);
    setReasons([]);
    setSaving(true);
    await store.save({ target, rating: next, reasonCodes: [] });
    setSaving(false);
    setStage("details");
  };

  const saveDetails = async () => {
    if (!rating) return;
    setSaving(true);
    await store.save({
      target,
      rating,
      reasonCodes: reasons,
      comment: comment.trim() || null,
    });
    setSaving(false);
    closeAndReturnFocus();
  };

  const state = existing?.rating ?? null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setStage("rate");
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Rate ${label}`}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            compact ? "min-w-[44px] justify-center px-2.5" : ""
          } ${className ?? ""}`}
        >
          <ThumbsUp
            className={`h-4 w-4 ${state === "up" ? "text-emerald-600" : ""}`}
            aria-hidden
            {...(state === "up" ? { fill: "currentColor" } : {})}
          />
          <ThumbsDown
            className={`h-4 w-4 ${state === "down" ? "text-destructive" : ""}`}
            aria-hidden
            {...(state === "down" ? { fill: "currentColor" } : {})}
          />
          {!compact && (
            <span className="text-[13px] font-medium">
              {state === "up" ? "Good response" : state === "down" ? "Bad response" : "Rate"}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        id={panelId}
        align="end"
        className="w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-2 shadow-lg"
        onEscapeKeyDown={closeAndReturnFocus}
      >
        {stage === "rate" ? (
          <div role="group" aria-label={`Rate ${label}`} className="flex flex-col">
            <button
              type="button"
              onClick={() => void rate("up")}
              aria-pressed={state === "up"}
              className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-left text-[15px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ThumbsUp className="h-4 w-4" aria-hidden /> Good response
            </button>
            <button
              type="button"
              onClick={() => void rate("down")}
              aria-pressed={state === "down"}
              className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-left text-[15px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ThumbsDown className="h-4 w-4" aria-hidden /> Bad response
            </button>
            {state && (
              <button
                type="button"
                onClick={() => setStage("details")}
                className="mt-1 min-h-[44px] rounded-xl px-3 text-left text-[13px] text-muted-foreground hover:bg-muted"
              >
                Add a reason (optional)
              </button>
            )}
          </div>
        ) : (
          <div className="p-2">
            <p className="text-[13px] font-medium">
              Thanks — anything more? <span className="text-muted-foreground">(optional)</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {chips.map((chip) => {
                const active = reasons.includes(chip.code);
                return (
                  <button
                    key={chip.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setReasons((prev) =>
                        prev.includes(chip.code)
                          ? prev.filter((c) => c !== chip.code)
                          : [...prev, chip.code].slice(0, 8),
                      )
                    }
                    className={`${CHIP} ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "hover:border-foreground/40"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <label className="mt-3 block text-[13px] text-muted-foreground" htmlFor={`${panelId}-note`}>
              What should we understand differently?
            </label>
            <textarea
              id={`${panelId}-note`}
              value={comment}
              maxLength={600}
              onChange={(event) => setComment(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {showCorrection && (
              <button
                type="button"
                onClick={() => {
                  onCorrectionRequested?.();
                  closeAndReturnFocus();
                }}
                className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-left text-[13px] hover:bg-muted"
              >
                Fix who said what or add missing context
              </button>
            )}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeAndReturnFocus}
                className="min-h-[44px] rounded-full px-3 text-[14px] text-muted-foreground hover:text-foreground"
              >
                Skip
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDetails()}
                className="min-h-[44px] rounded-full bg-foreground px-4 text-[14px] font-medium text-background disabled:opacity-60"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Your feedback helps personalise your future reads and improve the product. It does not
              retrain the model instantly.
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
