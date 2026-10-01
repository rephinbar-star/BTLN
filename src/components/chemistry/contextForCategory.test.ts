import { describe, expect, it } from "vitest";
import { CONTEXT_OPTIONS, contextForCategory } from "./InputSection";

describe("Deep Read relationship context", () => {
  const original = { conversation: "Maya: Hello", relationshipType: "romantic" as const, stage: "Engaged", duration: "2–5 years", goal: "Deciding whether to commit", context: "A recent change", yourName: "Maya", theirName: "Lee" };

  it("removes romantic-only selections while preserving the chat, identities, duration and context", () => {
    const friend = contextForCategory(original, "friend");
    expect(friend).toMatchObject({ relationshipType: "friend", stage: "", goal: "", conversation: original.conversation, yourName: "Maya", theirName: "Lee", duration: original.duration, context: original.context });
    expect(CONTEXT_OPTIONS.friend.stage).not.toContain("Married");
    expect(CONTEXT_OPTIONS.family.stage).not.toContain("Engaged");
  });

  it("keeps options valid in both categories and normalizes old redo context", () => {
    const friend = contextForCategory({ ...original, stage: "Other", goal: "Just curious" }, "friend");
    expect(friend.stage).toBe("Other");
    expect(contextForCategory({ ...friend, stage: "Married" }, "friend").stage).toBe("");
  });
});