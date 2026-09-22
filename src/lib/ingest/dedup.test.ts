import { describe, it, expect } from "vitest";
import { dedupeTranscript } from "../../../supabase/functions/_shared/dedupTranscript";

describe("screenshot overlap handling", () => {
  it("keeps legitimate repeated short messages with no timestamps", () => {
    const result = dedupeTranscript([
      { label: "Them", content: "can you send it today?", timestamp: null },
      { label: "You", content: "OK", timestamp: null },
      { label: "Them", content: "and the other file too", timestamp: null },
      { label: "You", content: "OK", timestamp: null },
    ]);
    expect(result.lines).toEqual([
      "Them: can you send it today?",
      "You: OK",
      "Them: and the other file too",
      "You: OK",
    ]);
    expect(result.removedDuplicates).toBe(0);
    expect(result.removedOverlap).toBe(0);
    expect(result.ambiguousRepeats).toBe(1);
    expect(result.warnings.join(" ")).toContain("kept as separate messages");
  });

  it("removes a demonstrated seam overlap between two screenshots", () => {
    const result = dedupeTranscript([
      { label: "Them", content: "are we still on for friday", timestamp: null },
      { label: "You", content: "yes, 7pm works", timestamp: null },
      { label: "Them", content: "perfect", timestamp: null },
      // second screenshot repeats the last two bubbles
      { label: "You", content: "yes, 7pm works", timestamp: null },
      { label: "Them", content: "perfect", timestamp: null },
      { label: "Them", content: "see you then", timestamp: null },
    ]);
    expect(result.lines).toEqual([
      "Them: are we still on for friday",
      "You: yes, 7pm works",
      "Them: perfect",
      "Them: see you then",
    ]);
    expect(result.removedOverlap).toBe(2);
    expect(result.ambiguousRepeats).toBe(0);
  });

  it("removes exact duplicates that carry the same timestamp", () => {
    const result = dedupeTranscript([
      { label: "You", content: "OK", timestamp: "09:14" },
      { label: "You", content: "OK", timestamp: "09:14" },
      { label: "You", content: "OK", timestamp: "11:02" },
    ]);
    expect(result.lines).toEqual(["You: OK", "You: OK"]);
    expect(result.removedDuplicates).toBe(1);
  });

  it("drops empty content and reports nothing when there is no overlap", () => {
    const result = dedupeTranscript([
      { label: "You", content: "  ", timestamp: null },
      { label: "Them", content: "hi", timestamp: null },
    ]);
    expect(result.lines).toEqual(["Them: hi"]);
    expect(result.warnings).toEqual([]);
  });
});
