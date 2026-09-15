import { supabase } from "@/integrations/supabase/client";
import type { RelationshipType } from "@/lib/coupleTypes";

export type { RelationshipType };

export const RELATIONSHIPS: RelationshipType[] = ["romantic", "friend", "family"];

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  romantic: "Romantic",
  friend: "Friends",
  family: "Family",
};

export type PairTypeRow = {
  id: number;
  romantic_name: string;
  friend_name: string;
  family_name: string;
  romantic_tagline: string;
  friend_tagline: string;
  family_tagline: string;
  romantic_superpower: string;
  friend_superpower: string;
  family_superpower: string;
  romantic_description: string;
  friend_description: string;
  family_description: string;
  background_color: string;
  text_color: string;
  decorative_element: string;
  image_url_romantic: string | null;
  image_url_friend: string | null;
  image_url_family: string | null;
  extras: PairTypeExtras | null;
};

export type PairTypeExtrasEntry = {
  friction?: string;
  advice?: string;
  examples?: string[];
};

export type PairTypeExtras = Partial<Record<RelationshipType, PairTypeExtrasEntry>>;

const COLUMNS =
  "id, romantic_name, friend_name, family_name, romantic_tagline, friend_tagline, family_tagline, romantic_superpower, friend_superpower, family_superpower, romantic_description, friend_description, family_description, background_color, text_color, decorative_element, image_url_romantic, image_url_friend, image_url_family, extras";

/** Stable, SEO-friendly slugs per pair type id (1..13). */
export const SLUG_BY_ID: Record<number, string> = {
  1: "power-couple",
  2: "steady-anchors",
  3: "slow-burners",
  4: "deep-feelers",
  5: "independent-duo",
  6: "magnet-and-moon",
  7: "support-system",
  8: "builders",
  9: "duet",
  10: "brave-duo",
  11: "solo-climbers",
  12: "quiet-companions",
  13: "fire-pair",
};

export const ID_BY_SLUG: Record<string, number> = Object.fromEntries(
  Object.entries(SLUG_BY_ID).map(([id, slug]) => [slug, Number(id)]),
);

/** URL segment per relationship: /types/{segment}/{slug}. */
export const SEGMENT_BY_RELATIONSHIP: Record<RelationshipType, string> = {
  romantic: "romantic",
  friend: "friends",
  family: "family",
};

export const RELATIONSHIP_BY_SEGMENT: Record<string, RelationshipType> = {
  romantic: "romantic",
  friends: "friend",
  friend: "friend",
  family: "family",
};

/** Canonical path for a pair type in a category. */
export const pairTypePath = (id: number, rel: RelationshipType) =>
  `/types/${SEGMENT_BY_RELATIONSHIP[rel]}/${SLUG_BY_ID[id]}`;

export const pairTypeUrl = (id: number, rel: RelationshipType) =>
  `https://betweenthelines.app${pairTypePath(id, rel)}`;

/**
 * Display titles drop the leading "The" (brand decision) — the stored
 * names keep it so nothing downstream of the database changes.
 */
export const displayName = (name: string) => name.replace(/^The\s+/i, "").trim();


export const fetchPairTypes = async (): Promise<PairTypeRow[]> => {
  const { data, error } = await supabase
    .from("couple_types")
    .select(COLUMNS)
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PairTypeRow[];
};

export const fetchPairType = async (id: number): Promise<PairTypeRow | null> => {
  const { data, error } = await supabase
    .from("couple_types")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PairTypeRow | null) ?? null;
};

export const fieldsFor = (row: PairTypeRow, rel: RelationshipType) => ({
  name: displayName(
    rel === "friend" ? row.friend_name : rel === "family" ? row.family_name : row.romantic_name,
  ),

  tagline:
    rel === "friend" ? row.friend_tagline : rel === "family" ? row.family_tagline : row.romantic_tagline,
  superpower:
    rel === "friend"
      ? row.friend_superpower
      : rel === "family"
        ? row.family_superpower
        : row.romantic_superpower,
  description:
    rel === "friend"
      ? row.friend_description
      : rel === "family"
        ? row.family_description
        : row.romantic_description,
  image:
    rel === "friend"
      ? row.image_url_friend
      : rel === "family"
        ? row.image_url_family
        : row.image_url_romantic,
  friction: row.extras?.[rel]?.friction ?? "",
  advice: row.extras?.[rel]?.advice ?? "",
  examples: row.extras?.[rel]?.examples ?? [],
});

export const isRelationship = (v: string | null): v is RelationshipType =>
  v === "romantic" || v === "friend" || v === "family";
