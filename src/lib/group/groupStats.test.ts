import { describe, expect, it } from "vitest";
import {
  computeGroupStats,
  detectSafetyConcern,
  type GroupMessage,
  type GroupParticipant,
} from "../../../supabase/functions/_shared/groupStats.ts";

const people = (n: number): GroupParticipant[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, display_name: `Person${i + 1}` }));

const msg = (
  id: string,
  content: string,
  order: number,
  ts: string | null = null,
): GroupMessage => ({ participant_id: id, content, ts, order });

describe("computeGroupStats", () => {
  it("computes deterministic message share", () => {
    const msgs = [
      msg("p1", "hello", 1),
      msg("p1", "again", 2),
      msg("p2", "hi", 3),
      msg("p3", "yo", 4),
    ];
    const s = computeGroupStats(people(3), msgs);
    expect(s.message_count).toBe(4);
    expect(s.participants.find((p) => p.id === "p1")!.share_pct).toBe(50);
    expect(s.participants.reduce((n, p) => n + p.messages, 0)).toBe(4);
  });

  it("marks quiet members", () => {
    const msgs = [
      ...Array.from({ length: 20 }, (_, i) => msg("p1", "chat", i + 1)),
      msg("p2", "yeah", 21),
      msg("p3", "ok", 22),
    ];
    const s = computeGroupStats(people(3), msgs);
    expect(s.participants.find((p) => p.id === "p2")!.quiet).toBe(true);
    expect(s.participants.find((p) => p.id === "p1")!.quiet).toBe(false);
  });

  it("counts questions and unanswered questions", () => {
    const msgs = [
      msg("p1", "are we still on?", 1),
      msg("p2", "yes", 2),
      msg("p3", "anyone bringing food?", 3),
      msg("p3", "hello?", 4),
      msg("p3", "still here?", 5),
      msg("p3", "ok then", 6),
      msg("p3", "fine", 7),
    ];
    const s = computeGroupStats(people(3), msgs);
    expect(s.total_questions).toBeGreaterThanOrEqual(4);
    expect(s.participants.find((p) => p.id === "p1")!.questions_asked).toBe(1);
    expect(s.participants.find((p) => p.id === "p1")!.questions_unanswered).toBe(0);
    expect(s.participants.find((p) => p.id === "p3")!.questions_unanswered).toBeGreaterThan(0);
  });

  it("marks timing metrics unavailable when there are no timestamps", () => {
    const s = computeGroupStats(people(3), [
      msg("p1", "a", 1),
      msg("p2", "b", 2),
      msg("p3", "c", 3),
    ]);
    expect(s.has_timestamps).toBe(false);
    expect(s.unavailable_metrics).toContain("initiation_patterns");
    expect(s.unavailable_metrics).toContain("response_times");
    expect(s.participants.every((p) => p.initiations === null)).toBe(true);
    expect(s.participants.every((p) => p.median_response_minutes === null)).toBe(true);
  });

  it("computes initiations and response times when timestamps exist", () => {
    const base = Date.UTC(2024, 2, 12, 9, 0, 0);
    const at = (mins: number) => new Date(base + mins * 60_000).toISOString();
    const s = computeGroupStats(people(3), [
      msg("p1", "morning", 1, at(0)),
      msg("p2", "hey", 2, at(5)),
      msg("p3", "hi", 3, at(10)),
      // new session after a long gap
      msg("p2", "back", 4, at(60 * 24)),
      msg("p1", "hi again", 5, at(60 * 24 + 4)),
    ]);
    expect(s.has_timestamps).toBe(true);
    expect(s.unavailable_metrics).not.toContain("response_times");
    expect(s.participants.find((p) => p.id === "p1")!.initiations).toBe(1);
    expect(s.participants.find((p) => p.id === "p2")!.initiations).toBe(1);
    expect(s.participants.find((p) => p.id === "p2")!.median_response_minutes).not.toBeNull();
  });

  it("ignores messages from unknown participants", () => {
    const s = computeGroupStats(people(3), [
      msg("p1", "a", 1),
      msg("p9", "ghost", 2),
      msg("p2", "b", 3),
    ]);
    expect(s.message_count).toBe(2);
  });
});

describe("detectSafetyConcern", () => {
  it("flags crisis and abuse content", () => {
    expect(detectSafetyConcern([msg("p1", "i want to kill myself", 1)])).toBeTruthy();
    expect(detectSafetyConcern([msg("p1", "he hit me again last night", 1)])).toBeTruthy();
  });

  it("does not flag ordinary banter", () => {
    expect(
      detectSafetyConcern([
        msg("p1", "who is bringing snacks", 1),
        msg("p2", "dying at that meme 😂", 2),
      ]),
    ).toBeFalsy();
  });
});
