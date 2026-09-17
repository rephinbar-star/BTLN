export type GroupRoastRole = {
  participant_id: string;
  role: string;
  headline: string;
  observed_behavior: string;
  evidence: string | null;
  confidence: "low" | "medium" | "high";
};

export type GroupRoastResult = {
  group_headline?: string;
  group_personality?: string;
  participant_roles?: GroupRoastRole[];
  interaction_dynamics?: string[];
  standout_moments?: { moment: string; evidence: string | null }[];
  seriously?: string;
  participants?: { id: string; display_name: string }[];
  safety_mode?: boolean;
  coverage?: {
    messages_supplied?: number;
    messages_read_by_ai?: number;
    chunk_count?: number;
    failed_chunks?: number;
    full_history_read?: boolean;
    date_start?: string | null;
    date_end?: string | null;
  };
};

export type GroupRoastPreview = {
  headline?: string;
  taste?: string;
  participant_count?: number;
  message_count?: number;
  top_role?: { role?: string; headline?: string } | null;
};

export type GroupRoastOwnerView = {
  id: string;
  status: string;
  participant_count: number;
  message_count: number;
  selected_period: Record<string, unknown>;
  participant_labels: { id: string; display_name: string }[];
  stats: Record<string, unknown>;
  coverage: Record<string, unknown>;
  preview: GroupRoastPreview | null;
  result: GroupRoastResult | null;
  observations: unknown[];
  is_unlocked: boolean;
  safety_blocked: boolean;
  error_message: string | null;
  created_at: string;
};

export type GroupRoastShareSnapshot = {
  v: number;
  title: string;
  personality: string;
  participant_count: number;
  message_count: number;
  include_names: boolean;
  include_quotes: boolean;
  roles: Array<{
    label: string;
    role: string;
    headline: string;
    observed_behavior: string;
    evidence?: string;
  }>;
  dynamics: string[];
  seriously: string;
  created_at: string;
};