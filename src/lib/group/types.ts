export type GroupCategory = "friends" | "family" | "work";

export const GROUP_CATEGORY_LABEL: Record<GroupCategory, string> = {
  friends: "Friends",
  family: "Family",
  work: "Work",
};

export type GroupRoleCard = {
  participant_id?: string;
  role?: string;
  headline?: string;
  why?: string;
  evidence?: string;
  confidence?: string;
};

export type GroupResultJson = {
  group_title?: string;
  group_summary?: string;
  role_cards?: GroupRoleCard[];
  balance?: { note?: string; flag?: string };
  initiation?: { available?: boolean; note?: string };
  unanswered?: { note?: string };
  repair?: { note?: string };
  group_strengths?: string[];
  subgroups?: { note?: string; confidence?: string }[];
  suggestions?: string[];
  safety_mode?: boolean;
  safety_mode_reason?: string | null;
  safety_notes?: string[];
  alternatives?: string[];
  confidence?: string;
  participants?: { id: string; display_name: string }[];
  coverage?: {
    messages_analyzed?: number;
    messages_supplied?: number;
    truncated?: boolean;
    unattributed_messages?: number;
    timestamp_coverage_pct?: number;
    unavailable_metrics?: string[];
  };
};

export type GroupStatsJson = {
  message_count?: number;
  participant_count?: number;
  has_timestamps?: boolean;
  timestamp_coverage_pct?: number;
  total_questions?: number;
  total_unanswered_questions?: number;
  unavailable_metrics?: string[];
  participants?: {
    id: string;
    messages: number;
    share_pct: number;
    avg_words: number;
    questions_asked: number;
    questions_unanswered: number;
    emoji_count: number;
    apology_tokens: number;
    initiations: number | null;
    median_response_minutes: number | null;
    quiet: boolean;
  }[];
};

export type GroupShareSnapshot = {
  v: number;
  category: GroupCategory;
  title: string;
  subtitle: string;
  participant_count: number;
  message_count: number | null;
  include_names: boolean;
  include_quotes: boolean;
  role_cards: {
    label: string;
    role: string;
    headline: string;
    why: string;
    evidence?: string;
    share_pct: number | null;
  }[];
  strengths: string[];
  /** Group-level next steps (v2 snapshots). No names, quotes or chat text. */
  suggestions?: string[];
  created_at: string;
};

export const METRIC_LABEL: Record<string, string> = {
  initiation_patterns: "Who starts conversations",
  response_times: "How fast people reply",
  activity_over_time: "Activity over time",
  full_attribution_coverage: "Every line matched to a person",
};

/** sha256 hex of a share token, computed in the browser. */
export const hashShareToken = async (token: string): Promise<string> => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
