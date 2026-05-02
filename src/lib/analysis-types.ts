export type AttachmentDimension = "secure" | "anxious" | "avoidant" | "disorganized";
export type PrimaryStyle = AttachmentDimension | "mixed/unclear";

export type AttachmentProfile = {
  primary_style: PrimaryStyle;
  scores: Partial<Record<AttachmentDimension, number>> & Record<string, number>;
  confidence: "low" | "medium" | "high" | string;
  evidence_quotes: string[];
};

export type Horseman = {
  present: boolean;
  evidence_quote?: string | null;
  evidence?: string | null;
};

export type ReportFlag =
  | string
  | {
      title?: string;
      evidence?: string;
      description?: string;
    };

export type AnalysisResult = {
  meta: {
    messages_analyzed: number;
    analysis_confidence: "low" | "medium" | "high" | string;
    safety_concern: boolean;
    safety_note?: string | null;
  };
  headline: {
    score: number;
    tier_label: string;
    vibe_summary: string;
  };
  sub_scores: {
    communication?: number | null;
    emotional_safety?: number | null;
    spark?: number | null;
    [k: string]: number | null | undefined;
  };
  communication_diagnostic: {
    response_time_asymmetry: string;
    initiator_balance: string;
    message_length_asymmetry: string;
    question_ratio: string;
    key_observation: string;
  };
  attachment_profiles: Record<string, AttachmentProfile>;
  four_horsemen: {
    criticism: Horseman;
    contempt: Horseman;
    defensiveness: Horseman;
    stonewalling: Horseman;
  };
  bids_for_connection: {
    turned_toward_pct?: number;
    turned_away_pct?: number;
    turned_against_pct?: number;
    [k: string]: unknown;
  };
  love_languages: unknown;
  green_flags: ReportFlag[];
  yellow_flags: ReportFlag[];
  red_flags: ReportFlag[];
  hidden_pattern: {
    title: string;
    description: string;
  };
  conversation_prompts: string[];
  compatibility_implication?: string;
};

export type ContextData = {
  name1: string;
  name2: string;
  relationship_stage?: string;
  duration?: string;
  goal?: string;
  free_text?: string;
};