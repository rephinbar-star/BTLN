import { describe, expect, it } from "vitest";
import { parseTranscript } from "@/lib/ingest/parse";
import { canonicalizeParsedConversation, parsedFromCanonical } from "@/lib/ingest/canonical";
import { mergeReviewedParticipants, renameReviewedParticipant } from "./reviewEdits";

describe("group review edits", () => {
  it("retains renamed and merged identities, message attribution and dates across canonical-to-context conversion", () => {
    const raw = "[12/03/2024, 10:00] Sam: hi\n[12/03/2024, 10:01] Lee: hello\n[12/03/2024, 10:02] Alex: hey";
    const original = canonicalizeParsedConversation(parseTranscript(raw), "paste", null);
    const [sam, lee, alex] = original.participants;
    const renamed = renameReviewedParticipant(original, sam.id, "Samantha");
    const merged = mergeReviewedParticipants(renamed, sam.id, lee.id);
    const resumed = parsedFromCanonical(merged);
    expect(resumed.participants.map((person) => person.display_name)).toEqual(["Samantha", alex.display_name]);
    expect(resumed.messages[1].participant_id).toBe(sam.id);
    expect(resumed.messages[1].ts).toBe(original.messages[1].ts);
    expect(merged.messages[1].provenance.sourceOrder).toBe(original.messages[1].provenance.sourceOrder);
  });
});
