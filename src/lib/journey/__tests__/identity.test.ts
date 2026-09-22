import { describe, expect, it } from "vitest";
import { sourceState, SOURCE_STATE_LABELS, type JourneySource } from "../types";

const base: JourneySource = {
  id: "s1",
  relationship_id: "r1",
  source_kind: "deep_read",
  source_id: "d1",
  subject_participant: "Rae",
  identity_status: "confirmed",
  date_precision: "unknown" as const,
  date_provenance: "unknown" as const,
  dated_count: 0,
  undated_count: 0,
  date_note: null,
  observed_period_start: null,
  observed_period_end: null,
  uploaded_at: "2026-01-01T00:00:00Z",
  consent_at: "2026-01-01T00:00:00Z",
  excluded_at: null,
};

describe("journey source identity state", () => {
  it("counts a confirmed, non-excluded source as included", () => {
    expect(sourceState(base)).toBe("included");
  });

  it("asks for identity when the participant is not confirmed", () => {
    expect(sourceState({ ...base, identity_status: "pending", subject_participant: null })).toBe(
      "identify",
    );
  });

  it("never treats a confirmed status without a participant as included", () => {
    expect(sourceState({ ...base, subject_participant: null })).toBe("identify");
  });

  it("keeps a conversation the person is absent from out, even if not excluded", () => {
    expect(sourceState({ ...base, identity_status: "absent", subject_participant: null })).toBe(
      "not_you",
    );
  });

  it("shows excluded ahead of included once excluded", () => {
    expect(sourceState({ ...base, excluded_at: "2026-02-01T00:00:00Z" })).toBe("excluded");
  });

  it("has plain-language labels for every state", () => {
    expect(SOURCE_STATE_LABELS.identify).toBe("Identify yourself to include");
    expect(SOURCE_STATE_LABELS.not_you).toBe("You are not in this conversation");
  });
});
