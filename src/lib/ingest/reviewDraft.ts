import type { CanonicalConversation, CanonicalSourceKind } from "./canonical";

export type ReviewedInput = { key: string; conversation: CanonicalConversation };
export type ReviewCache = Partial<Record<CanonicalSourceKind, ReviewedInput>>;

export function inputKey(method: CanonicalSourceKind, text: string, sourceName: string | null, screenshotIds: string[], side: "left" | "right" | null, absent: boolean): string {
  return JSON.stringify(method === "screenshots" ? [method, screenshotIds, side, absent] : [method, text, sourceName]);
}

export function matchingReview(cache: ReviewCache | undefined, method: CanonicalSourceKind, key: string): CanonicalConversation | null {
  const entry = cache?.[method];
  return entry?.key === key ? entry.conversation : null;
}

export function saveReview(cache: ReviewCache | undefined, method: CanonicalSourceKind, key: string, conversation: CanonicalConversation): ReviewCache {
  return { ...cache, [method]: { key, conversation } };
}
