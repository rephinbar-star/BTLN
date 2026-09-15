/**
 * Single canonical registry of pair-type slugs and retired aliases.
 *
 * Dependency-free on purpose: both the app (`src/lib/pairTypes.ts`) and the
 * build-time prerender script import this, so there must be exactly one
 * source of truth for ids → public slugs.
 *
 * Display NAMES are never hardcoded here — they live in the `couple_types`
 * table and are read through `fieldsFor`/`displayName`.
 */

export const SLUG_BY_ID: Record<number, string> = {
  1: "solid-bond",
  2: "steady-anchors",
  3: "quiet-loyalists",
  4: "deep-feelers",
  5: "independent-duo",
  6: "push-pull-pair",
  7: "support-system",
  8: "builders",
  9: "duet",
  10: "brave-duo",
  11: "solo-climbers",
  12: "low-hum",
  13: "fire-pair",
};

/** Retired slugs kept alive so old links never 404. */
export const SLUG_ALIASES: Record<string, number> = {
  "power-couple": 1,
  "power-duo": 1,
  "slow-burners": 3,
  "parallel-players": 5,
  "magnet-and-moon": 6,
  "quiet-companions": 12,
  "sparring-partners": 13,
};


export const ID_BY_SLUG: Record<string, number> = {
  ...Object.fromEntries(Object.entries(SLUG_BY_ID).map(([id, slug]) => [slug, Number(id)])),
  ...SLUG_ALIASES,
};

/** Display titles drop the leading "The" (brand decision). */
export const displayName = (name: string) => name.replace(/^The\s+/i, "").trim();
