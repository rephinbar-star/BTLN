// Centralized qualitative labels for raw 0-100 scores.
// Tune thresholds and label sets here — do NOT surface raw numbers in UI.

export type ScoreAxis = "communication" | "emotional_safety" | "reciprocity" | "spark";

export const SCORE_THRESHOLDS = {
  low: 50,   // 0-49  -> bottom label
  high: 75,  // 75-100 -> top label, 50-74 -> middle label
} as const;

const LABELS: Record<ScoreAxis, [string, string, string]> = {
  communication: ["Pigeons", "Airmail", "Psychic"],
  emotional_safety: ["On Guard", "Secure", "Like a Rock"],
  reciprocity: ["Tower of Pisa", "Golden Gate Bridge", "Taj Mahal"],
  spark: ["Dim", "Glow", "Lightning"],
};

export const AXIS_DISPLAY: Record<ScoreAxis, string> = {
  communication: "Communication",
  emotional_safety: "Emotional Safety",
  reciprocity: "Reciprocity",
  spark: "Spark",
};

export type Band = "low" | "mid" | "high";

export const scoreBand = (raw: number | null | undefined): Band | null => {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return null;
  if (raw < SCORE_THRESHOLDS.low) return "low";
  if (raw < SCORE_THRESHOLDS.high) return "mid";
  return "high";
};

export const scoreLabel = (axis: ScoreAxis, raw: number | null | undefined): string | null => {
  const band = scoreBand(raw);
  if (!band) return null;
  const [lo, mid, hi] = LABELS[axis];
  return band === "low" ? lo : band === "mid" ? mid : hi;
};

export const bandToneClass = (band: Band | null): string => {
  switch (band) {
    case "high":
      return "bg-pastel-green-bg text-pastel-green-fg-strong";
    case "mid":
      return "bg-pastel-purple-bg text-pastel-purple-fg-strong";
    case "low":
      return "bg-pastel-amber-bg text-pastel-amber-fg-strong";
    default:
      return "bg-muted text-muted-foreground";
  }
};

// Hedge labels for low-confidence analyses — never present as definitive.
export const hedgeLabel = (label: string | null): string | null =>
  label ? `${label}?` : null;