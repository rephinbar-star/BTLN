import { describe, expect, it } from "vitest";
import { canonicalizeParsedConversation } from "./canonical";
import { parseTranscript } from "./parse";
import { inputKey, matchingReview, saveReview } from "./reviewDraft";

describe("review draft retention", () => {
  it("retains corrections, timestamps and provenance through back and method round trips, invalidating only materially changed input", () => {
    const raw = "[12/03/2024, 10:00] Sam: original\n[12/03/2024, 10:01] Lee: okay";
    const key = inputKey("paste", raw, null, [], null, false);
    const initial = canonicalizeParsedConversation(parseTranscript(raw), "paste", null);
    const corrected = { ...initial, messages: initial.messages.map((message, index) => index ? message : { ...message, content: "corrected", provenance: { ...message.provenance, confidence: "confirmed" as const } }) };
    const cache = saveReview(undefined, "paste", key, corrected);
    expect(matchingReview(cache, "paste", key)?.messages[0]).toMatchObject({ content: "corrected", ts: initial.messages[0].ts, provenance: { sourceOrder: 0, confidence: "confirmed" } });
    expect(matchingReview(cache, "chat_export", inputKey("chat_export", raw, "a.txt", [], null, false))).toBeNull();
    expect(matchingReview(cache, "paste", key)?.messages[0].content).toBe("corrected");
    expect(matchingReview(cache, "paste", inputKey("paste", `${raw}\nSam: changed`, null, [], null, false))).toBeNull();
  });
});
