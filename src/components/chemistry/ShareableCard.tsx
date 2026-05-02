import { Heart } from "lucide-react";
import { forwardRef } from "react";
import type { AnalysisResult, ContextData } from "@/lib/analysis-types";

const TIER_PILL: Record<string, string> = {
  "Soulmate Energy": "bg-pastel-green-bg text-pastel-green-fg-strong",
  "Power Couple": "bg-pastel-green-bg text-pastel-green-fg-strong",
  "In Sync": "bg-pastel-purple-bg text-pastel-purple-fg-strong",
  "Slow Burn": "bg-pastel-blue-bg text-pastel-blue-fg",
  "Crossed Wires": "bg-pastel-amber-bg text-pastel-amber-fg-strong",
  Mismatch: "bg-pastel-pink-bg text-pastel-pink-fg",
};

const tierClass = (label: string) =>
  TIER_PILL[label] ?? "bg-muted text-foreground";

const fmtScore = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : String(Math.round(n));

type Props = {
  result: AnalysisResult;
  context: ContextData;
};

export const ShareableCard = forwardRef<HTMLDivElement, Props>(
  ({ result, context }, ref) => {
    const { name1, name2 } = context;
    const greenFlag = result.green_flags?.[0];
    const yellowFlag = result.yellow_flags?.[0];
    const fallbackHidden = result.hidden_pattern?.description;
    const highlight = greenFlag ?? fallbackHidden ?? "";
    const showBoth = Boolean(greenFlag && yellowFlag);

    const profile1 = result.attachment_profiles?.[name1];
    const profile2 = result.attachment_profiles?.[name2];

    return (
      <div
        ref={ref}
        className="mx-auto w-full max-w-[400px] rounded-[20px] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7"
      >
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5 fill-foreground text-foreground" strokeWidth={0} />
            <span className="text-[13px] font-medium tracking-tight">chemistry.app</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {result.meta.messages_analyzed} messages analyzed
          </span>
        </div>

        {/* Score */}
        <div className="mt-6 flex flex-col items-center text-center">
          <span className="text-xs text-muted-foreground">
            {name1} & {name2}
          </span>
          <span className="mt-1 text-[80px] font-medium leading-none tracking-tight">
            {fmtScore(result.headline.score)}
          </span>
          <span
            className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${tierClass(
              result.headline.tier_label,
            )}`}
          >
            {result.headline.tier_label}
          </span>
        </div>

        {/* Vibe quote */}
        <p className="mt-5 text-center text-[13px] italic leading-relaxed text-muted-foreground">
          “{result.headline.vibe_summary}”
        </p>

        {/* Sub-scores */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: "Communication", value: result.sub_scores.communication },
            { label: "Safety", value: result.sub_scores.emotional_safety },
            { label: "Spark", value: result.sub_scores.spark },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-muted px-2 py-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {s.label}
              </div>
              <div className="mt-0.5 text-base font-medium">{fmtScore(s.value)}</div>
            </div>
          ))}
        </div>

        {/* Flag callouts */}
        <div className={`mt-4 grid gap-2 ${showBoth ? "grid-cols-2" : "grid-cols-1"}`}>
          {highlight && (
            <div className="rounded-lg bg-pastel-green-bg p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-pastel-green-fg">
                Green flag
              </div>
              <p className="mt-1 text-[11px] leading-snug text-pastel-green-fg">{highlight}</p>
            </div>
          )}
          {yellowFlag && (
            <div className="rounded-lg bg-pastel-amber-bg p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-pastel-amber-fg-strong">
                Watch
              </div>
              <p className="mt-1 text-[11px] leading-snug text-pastel-amber-fg-strong">
                {yellowFlag}
              </p>
            </div>
          )}
        </div>

        {/* Attachment styles row */}
        {(profile1 || profile2) && (
          <>
            <div className="my-4 h-px w-full bg-border" />
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Attachment styles
            </div>
            <p className="mt-1 text-[12px] text-foreground">
              {name1} {profile1?.primary_style ?? "—"} · {name2} {profile2?.primary_style ?? "—"}
            </p>
          </>
        )}
      </div>
    );
  },
);

ShareableCard.displayName = "ShareableCard";