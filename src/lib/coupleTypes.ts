import { displayName } from "@/lib/pairTypes";

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

export const pickFields = (type: CoupleType, relationship: RelationshipType) => {
  switch (relationship) {
    case "friend":
      return {
        name: displayName(type.friend_name),
        tagline: type.friend_tagline,
        superpower: type.friend_superpower,
        description: type.friend_description,
      };
    case "family":
      return {
        name: displayName(type.family_name),
        tagline: type.family_tagline,
        superpower: type.family_superpower,
        description: type.family_description,
      };
    case "romantic":
    default:
      return {
        name: displayName(type.romantic_name),
        tagline: type.romantic_tagline,
        superpower: type.romantic_superpower,
        description: type.romantic_description,
      };
  }
};