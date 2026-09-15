import { describe, expect, it } from "vitest";
import { SLUG_BY_ID, SLUG_ALIASES, ID_BY_SLUG, displayName } from "@/lib/pairTypeSlugs";

describe("pair type slug registry", () => {
  it("has a unique slug for each of the 13 types", () => {
    const slugs = Object.values(SLUG_BY_ID);
    expect(slugs).toHaveLength(13);
    expect(new Set(slugs).size).toBe(13);
  });

  it("uses the approved canonical slugs", () => {
    expect(SLUG_BY_ID[3]).toBe("quiet-loyalists");
    expect(SLUG_BY_ID[5]).toBe("independent-duo");
    expect(SLUG_BY_ID[8]).toBe("builders");
    expect(SLUG_BY_ID[12]).toBe("low-hum");
    expect(SLUG_BY_ID[13]).toBe("fire-pair");
  });

  it("keeps retired slugs resolvable to their type", () => {
    expect(ID_BY_SLUG["slow-burners"]).toBe(3);
    expect(ID_BY_SLUG["parallel-players"]).toBe(5);
    expect(ID_BY_SLUG["quiet-companions"]).toBe(12);
    expect(ID_BY_SLUG["sparring-partners"]).toBe(13);
  });

  it("never lets an alias shadow a live slug", () => {
    const live = new Set(Object.values(SLUG_BY_ID));
    for (const alias of Object.keys(SLUG_ALIASES)) {
      expect(live.has(alias)).toBe(false);
    }
  });

  it("drops a leading The from display titles", () => {
    expect(displayName("The Fire Pair")).toBe("Fire Pair");
    expect(displayName("Low Hum")).toBe("Low Hum");
  });
});
