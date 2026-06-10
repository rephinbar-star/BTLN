import { Star } from "lucide-react";
import { type ScoreAxis } from "@/lib/score-labels";

type Props = {
  axis: ScoreAxis;
  category: string;
  labels: [string, string, string]; // worst -> best
  earnedIndex: 0 | 1 | 2 | null; // null when low-confidence / unknown
  lowConfidence?: boolean;
};

/**
 * 3-segment connected stepper showing best -> worst progression (top = better).
 * Highlights earned rung with primary fill, bold weight, and a dot marker —
 * never color alone. On narrow screens, stacks vertically so long labels stay legible.
 * All colors reference design-system tokens so the component adapts to theme changes.
 */
export const SubScoreScale = ({ category, labels, earnedIndex, lowConfidence }: Props) => {
  const tentative = lowConfidence || earnedIndex === null;

  // Render best -> worst; earnedIndex (0=worst, 2=best) inverts to display position.
  const displayLabels = [labels[2], labels[1], labels[0]] as const;
  const displayEarnedIndex = earnedIndex !== null ? (2 - earnedIndex) : null;

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-olive-deep">
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
        aria-label={`${category} scale, best to worst`}
        className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:gap-0"
      >
        {displayLabels.map((label, i) => {
          const isEarned = !tentative && displayEarnedIndex === i;
          const first = i === 0;
          const last = i === displayLabels.length - 1;

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
                  ? "bg-sage-muted text-white"
                  : "bg-muted/40 text-foreground",
              ].join(" ")}
            >
              {isEarned && (
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white"
                />
              )}
              <span className="flex items-center gap-0.5">
                {Array.from({ length: 3 - i }).map((_, starIdx) => (
                  <Star
                    key={starIdx}
                    aria-hidden="true"
                    className="h-2.5 w-2.5 fill-current"
                  />
                ))}
              </span>
              <span
                className={[
                  "min-w-0 break-words text-[11px] leading-tight",
                  isEarned ? "font-semibold" : "font-normal",
                ].join(" ")}
              >
                {label}
              </span>
              {isEarned && <span className="sr-only">(you&apos;re here)</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
