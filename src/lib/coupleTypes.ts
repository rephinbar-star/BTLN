import { supabase } from "@/integrations/supabase/client";

export type RelationshipType = "romantic" | "friend" | "family";

export type CoupleType = {
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
};

// Maps couple_type id → slug used in illustration filenames.
const slugMap: Record<number, string> = {
  1: "power-couple",
  2: "steady-anchors",
  3: "slow-burners",
  4: "deep-feelers",
  5: "independent-duo",
  6: "magnet-moon",
  7: "support-system",
  8: "builders",
  9: "duet",
  10: "brave-duo",
  11: "solo-climbers",
  12: "quiet-companions",
  13: "fire-pair",
};

/**
 * Returns the public URL for a couple type illustration in the
 * `couple_types` Supabase storage bucket. Filename pattern:
 *   {slug}-{relationship_type}.png
 * e.g. "power-couple-romantic.png", "fire-pair-family.png".
 *
 * If the asset hasn't been uploaded yet, the URL will 404 — callers
 * should handle the image `onError` and fall back to a placeholder.
 */
export const getCoupleTypeIllustrationUrl = (
  typeId: number,
  relationship: RelationshipType,
): string | null => {
  const slug = slugMap[typeId];
  if (!slug) return null;
  const filename = `${slug}-${relationship}.png`;
  const { data } = supabase.storage.from("couple_types").getPublicUrl(filename);
  return data?.publicUrl ?? null;
};

export const pickFields = (type: CoupleType, relationship: RelationshipType) => {
  switch (relationship) {
    case "friend":
      return {
        name: type.friend_name,
        tagline: type.friend_tagline,
        superpower: type.friend_superpower,
        description: type.friend_description,
      };
    case "family":
      return {
        name: type.family_name,
        tagline: type.family_tagline,
        superpower: type.family_superpower,
        description: type.family_description,
      };
    case "romantic":
    default:
      return {
        name: type.romantic_name,
        tagline: type.romantic_tagline,
        superpower: type.romantic_superpower,
        description: type.romantic_description,
      };
  }
};