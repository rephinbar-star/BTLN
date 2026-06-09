import { Heart } from "lucide-react";
import { Info } from "lucide-react";
import { forwardRef } from "react";
import type { AnalysisResult, ContextData } from "@/lib/analysis-types";
import {
  AXIS_DISPLAY,
  bandToneClass,
  hedgeLabel,
  scoreBand,
  scoreLabel,
  type ScoreAxis,
} from "@/lib/score-labels";

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

const flagText = (flag: unknown) => {
  if (!flag) return "";
  if (typeof flag === "string") return flag;
  if (typeof flag === "object") {
    const value = flag as { title?: unknown; description?: unknown; evidence?: unknown };
    return [value.title, value.description, value.evidence]
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .join(" — ");
  }
  return String(flag);
};

type Props = {
  result: AnalysisResult;
  context: ContextData;
};

export const ShareableCard = forwardRef<HTMLDivElement, Props>(
  ({ result, context }, ref) => {
    const { name1, name2 } = context;
    const greenFlag = flagText(result.green_flags?.[0]);
    const yellowFlag = flagText(result.yellow_flags?.[0]);
    const fallbackHidden = result.hidden_pattern?.description;
    const highlight = greenFlag ?? fallbackHidden ?? "";
    const showBoth = Boolean(greenFlag && yellowFlag);

    const profile1 = result.attachment_profiles?.[name1];
    const profile2 = result.attachment_profiles?.[name2];

    const lowConfidence = result.meta?.analysis_confidence === "low";
    const subAxes: ScoreAxis[] = [
      "communication",
      "emotional_safety",
      "reciprocity",
      "spark",
    ];
    const subScoreItems = subAxes
      .map((axis) => {
        const raw = (result.sub_scores as Record<string, number | null | undefined>)?.[axis];
        const label = scoreLabel(axis, raw);
        if (!label) return null;
        const band = scoreBand(raw);
        const display = lowConfidence ? hedgeLabel(label) : label;
        return { axis, label: display!, band };
      })
      .filter((x): x is { axis: ScoreAxis; label: string; band: ReturnType<typeof scoreBand> } => !!x);

    return (
      <div
        ref={ref}
        className="mx-auto w-full max-w-[400px] rounded-[20px] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7"
      >
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5 fill-foreground text-foreground" strokeWidth={0} />
            <span className="text-[13px] font-medium tracking-tight">betweenthelines.app</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {result.meta.messages_analyzed} messages analyzed
          </span>
        </div>

        {/* Headline tier — no numeric score */}
        <div className="mt-6 flex flex-col items-center text-center">
          <h2 className="text-[26px] font-bold tracking-tight sm:text-[32px]">
            {name1} & {name2}
          </h2>
          <h3
            className={`mt-3 inline-flex items-center rounded-full px-4 py-1.5 text-[20px] font-medium leading-tight tracking-tight sm:text-[24px] ${tierClass(
              result.headline.tier_label,
            )}`}
          >
            {lowConfidence ? `${result.headline.tier_label}?` : result.headline.tier_label}
          </h3>
        </div>

        {/* Vibe quote */}
        <p className="mt-5 text-center text-[13px] italic leading-relaxed text-muted-foreground">
          “{result.headline.vibe_summary}”
        </p>

        {lowConfidence && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-pastel-amber-bg p-3 text-pastel-amber-fg">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <p className="text-[12px] leading-relaxed">
              Low confidence: only {result.meta.messages_analyzed} messages were available.
              Treat this as a snapshot, not a portrait of the relationship.
            </p>
          </div>
        )}

        {/* Sub-scores — qualitative labels only */}
        {subScoreItems.length > 0 && (
          <div
            className={`mt-5 grid gap-2 ${
              subScoreItems.length >= 4 ? "grid-cols-2" : "grid-cols-3"
            }`}
          >
            {subScoreItems.map((s) => (
              <div key={s.axis} className="rounded-lg bg-muted px-2 py-2.5 text-center">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {AXIS_DISPLAY[s.axis]}
                </div>
                <div
                  className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${bandToneClass(
                    s.band,
                  )}`}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

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