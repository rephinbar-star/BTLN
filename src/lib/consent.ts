// Lightweight analytics-consent layer.
//
// EU visitors: opt-in required. Until they accept, PostHog stays opted-out
// and no events are sent.
// Non-EU visitors: implicit grant with a disclosure in the privacy policy.
//
// Region detection uses the browser's IANA timezone — good enough for
// a soft EU gate (no IP geolocation, no third party calls).

const STORAGE_KEY = "btln_analytics_consent";

export type ConsentState = "granted" | "denied" | "unset";

const EU_TZ_PREFIXES = [
  "Europe/",
  "Atlantic/Azores",
  "Atlantic/Canary",
  "Atlantic/Madeira",
  "Atlantic/Faroe",
  "Atlantic/Reykjavik",
];

// Timezones that live under Europe/* but are NOT in the EU/EEA/UK/CH where
// we want opt-in. We keep the gate broad on purpose — false positives just
// mean a visitor sees a banner.
export const isLikelyEU = (): boolean => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    return EU_TZ_PREFIXES.some((p) => tz.startsWith(p));
  } catch {
    return false;
  }
};

export const getConsent = (): ConsentState => {
  if (typeof window === "undefined") return "unset";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "granted" || v === "denied") return v;
  return "unset";
};

export const setConsent = (state: "granted" | "denied"): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, state);
};

// Whether analytics may run right now without explicit consent.
// Non-EU: yes (disclosure-only). EU: only if the user explicitly granted.
export const isConsentRequired = (): boolean => isLikelyEU();

export const shouldRunAnalytics = (): boolean => {
  const state = getConsent();
  if (state === "denied") return false;
  if (state === "granted") return true;
  // unset: allowed only outside the EU
  return !isConsentRequired();
};