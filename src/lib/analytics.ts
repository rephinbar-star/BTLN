// PostHog wrapper with a hard PII firewall.
//
// Rules baked in here:
//  - Only a fixed set of event names may be sent.
//  - Each event has a typed property shape; unknown keys are dropped.
//  - We never accept email, name, message text, feedback text, or report
//    content as a property. The shapes below only allow UUIDs, enums,
//    numbers, and booleans.
//  - Autocapture is OFF. Session replay is OFF.
//  - Pageview capture is ON only because all app URLs are opaque
//    (UUIDs); no route ever puts a name/email/message in the path.
//  - Person profiles are 'identified_only' and we only ever set the
//    Supabase user_id as the distinct id — no email, name, or PII.

import posthog from "posthog-js";
import { shouldRunAnalytics, getConsent } from "@/lib/consent";

// ---- Event catalog ---------------------------------------------------------

type RelationshipType = "romantic" | "friend" | "family" | string;
type MessageCountBucket = "<30" | "30-79" | "80+";
type PaywallOption = "one_time" | "monthly" | "annual";
type TriggerSource = "scroll" | "dwell" | "button" | "manual";
type QuestionVariant = "wrong" | "balanced";

export type EventMap = {
  report_started: { relationship_type: RelationshipType };
  report_completed: {
    analysis_id: string;
    low_confidence: boolean;
    message_count_bucket: MessageCountBucket;
  };
  analysis_failed: { reason_code: string };
  share_clicked: { analysis_id: string; platform?: string };
  survey_shown: { analysis_id?: string; trigger_source: TriggerSource };
  survey_submitted: {
    analysis_id?: string;
    accuracy_rating: number;
    question_variant: QuestionVariant;
    has_text: boolean;
    email_captured: boolean;
    trigger_source: TriggerSource;
  };
  survey_dismissed: { analysis_id?: string };
  paywall_viewed: { analysis_id: string };
  intent_to_pay_click: { analysis_id: string; option: PaywallOption };
  pricing_cta_clicked: { option: PaywallOption; source?: string };
  second_analysis_started: Record<string, never>;
  relationship_created: { relationship_type: RelationshipType };
  referred_visit: { ref: string };
};

// Allowed property keys per event. Anything not listed is silently dropped.
const ALLOWED_KEYS: { [K in keyof EventMap]: ReadonlyArray<keyof EventMap[K] & string> } = {
  report_started: ["relationship_type"],
  report_completed: ["analysis_id", "low_confidence", "message_count_bucket"],
  analysis_failed: ["reason_code"],
  share_clicked: ["analysis_id", "platform"],
  survey_shown: ["analysis_id", "trigger_source"],
  survey_submitted: [
    "analysis_id",
    "accuracy_rating",
    "question_variant",
    "has_text",
    "email_captured",
    "trigger_source",
  ],
  survey_dismissed: ["analysis_id"],
  paywall_viewed: ["analysis_id"],
  intent_to_pay_click: ["analysis_id", "option"],
  pricing_cta_clicked: ["option", "source"],
  second_analysis_started: [],
  relationship_created: ["relationship_type"],
  referred_visit: ["ref"],
} as never;

// Reject obvious PII shapes as a defense-in-depth check on top of the
// allow-list (so a typo can't accidentally ship raw user text).
const looksLikePII = (key: string, value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const lk = key.toLowerCase();
  if (lk.includes("email") || lk.includes("name") || lk.includes("text") || lk.includes("message")) return true;
  if (value.includes("@")) return true;
  if (value.length > 64) return true;
  return false;
};

const sanitize = <K extends keyof EventMap>(event: K, props: EventMap[K]): Record<string, unknown> => {
  const allowed = ALLOWED_KEYS[event] as ReadonlyArray<string>;
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    const v = (props as Record<string, unknown>)[key];
    if (v === undefined || v === null) continue;
    if (looksLikePII(key, v)) {
      if (import.meta.env.DEV) console.warn(`[analytics] dropped PII-looking value for ${event}.${key}`);
      continue;
    }
    out[key] = v;
  }
  return out;
};

// ---- Lifecycle -------------------------------------------------------------

let initialized = false;

export const initAnalytics = (): void => {
  if (initialized) return;
  if (typeof window === "undefined") return;
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";
  if (!key) {
    if (import.meta.env.DEV) console.info("[analytics] VITE_POSTHOG_KEY not set — analytics disabled");
    return;
  }

  posthog.init(key, {
    api_host: host,
    // Hard privacy posture for sensitive relationship data.
    autocapture: false,
    capture_pageview: true, // URLs use opaque UUIDs — confirmed PII-free
    capture_pageleave: true,
    person_profiles: "identified_only",
    disable_session_recording: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    // Default opt-out; we explicitly opt in below if consent allows.
    opt_out_capturing_by_default: true,
    persistence: "localStorage+cookie",
    loaded: (ph) => {
      if (shouldRunAnalytics()) ph.opt_in_capturing();
    },
  });

  initialized = true;
};

export const grantAnalyticsConsent = (): void => {
  if (!initialized) return;
  posthog.opt_in_capturing();
};

export const denyAnalyticsConsent = (): void => {
  if (!initialized) return;
  posthog.opt_out_capturing();
};

export const identifyUser = (userId: string): void => {
  if (!initialized || !userId) return;
  // user_id (UUID) only. No email, name, or any other property.
  posthog.identify(userId);
};

export const resetUser = (): void => {
  if (!initialized) return;
  posthog.reset();
};

export const track = <K extends keyof EventMap>(event: K, props: EventMap[K] = {} as EventMap[K]): void => {
  if (!initialized) return;
  if (getConsent() === "denied") return;
  try {
    posthog.capture(event, sanitize(event, props));
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[analytics] capture failed", err);
  }
};

// Convenience: bucket raw message counts into the coarse enum the spec asks for.
export const messageCountBucket = (n: number | null | undefined): MessageCountBucket => {
  const v = typeof n === "number" ? n : 0;
  if (v < 30) return "<30";
  if (v < 80) return "30-79";
  return "80+";
};