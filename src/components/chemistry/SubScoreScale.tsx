import { type ScoreAxis } from "@/lib/score-labels";

type Props = {
  axis: ScoreAxis;
  category: string;
  labels: [string, string, string]; // worst -> best
  earnedIndex: 0 | 1 | 2 | null; // null when low-confidence / unknown
  lowConfidence?: boolean;
};

/**
 * 3-segment connected stepper showing worst -> best progression.
 * Highlights earned rung with brand accent fill, bold weight, and a dot marker —
 * never color alone. On narrow screens, stacks vertically so long labels stay legible.
 */
export const SubScoreScale = ({ category, labels, earnedIndex, lowConfidence }: Props) => {
  const tentative = lowConfidence || earnedIndex === null;

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {category}
        </div>
        {tentative && (
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Preliminary
          </div>
        )}
      </div>

      {/* Stepper: horizontal on sm+, stacked vertical on narrow screens */}
      <div
        role="group"
        aria-label={`${category} scale, worst to best`}
        className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:gap-0"
      >
        {labels.map((label, i) => {
          const isEarned = !tentative && earnedIndex === i;
          const first = i === 0;
          const last = i === labels.length - 1;

          return (
            <div
              key={label}
              aria-current={isEarned ? "true" : undefined}
              className={[
                "flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2 text-center",
                "border border-border",
                // Rounded ends: full radius when stacked, side-radius when in a row
                "rounded-md sm:rounded-none",
                first ? "sm:rounded-l-md" : "sm:border-l-0",
                last ? "sm:rounded-r-md" : "",
                isEarned
                  ? "bg-foreground text-background"
                  : "bg-muted/40 text-muted-foreground",
              ].join(" ")}
            >
              {isEarned && (
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-background"
                />
              )}
              <span
                className={[
                  "min-w-0 break-words text-[11px] leading-tight",
                  isEarned ? "font-semibold" : "font-normal",
                ].join(" ")}
              >
                {label}
              </span>
              {isEarned && <span className="sr-only">(you're here)</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};