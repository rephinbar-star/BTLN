import { describe, expect, it } from "vitest";
import type { IngestMessage, IngestParticipant } from "@/lib/ingest/parse";
import {
  availablePeriods,
  computeWrappedStats,
  pseudonymMap,
  type WrappedPeriod,
} from "./stats";

const P: IngestParticipant[] = [
  { id: "a", display_name: "Ada", aliases: [], message_count: 0, excluded: false, is_self: true, looks_like_system: false },
  { id: "b", display_name: "Ben", aliases: [], message_count: 0, excluded: false, is_self: false, looks_like_system: false },
];

let order = 0;
const msg = (
  participant_id: string | null,
  ts: string | null,
  content: string,
  kind: IngestMessage["kind"] = "message",
): IngestMessage => ({ participant_id, raw_sender: null, content, ts, kind, order: ++order });

const PERIOD: WrappedPeriod = { kind: "month", from: "2026-01-01", to: "2026-01-31", label: "January 2026" };

describe("computeWrappedStats", () => {
  it("counts totals, words and per-person shares over exactly the given messages", () => {
    order = 0;
    const s = computeWrappedStats(
      [
        msg("a", "2026-01-01T09:00:00Z", "hey there"),
        msg("b", "2026-01-01T09:05:00Z", "hi"),
        msg("a", "2026-01-01T09:06:00Z", "how are you"),
        msg(null, null, "Messages are end-to-end encrypted", "system"),
      ],
      P,
      PERIOD,
    );
    expect(s.totals.messages).toBe(3);
    expect(s.totals.system).toBe(1);
    expect(s.totals.words).toBe(6);
    expect(s.totals.withoutTime).toBe(0);
    expect(s.participants[0]).toMatchObject({ id: "a", messages: 2 });
    expect(s.participants[1]).toMatchObject({ id: "b", messages: 1 });
    expect(s.participants[0].share).toBeCloseTo(2 / 3);
  });

  it("splits sessions on the configured gap and attributes initiation", () => {
    order = 0;
    const s = computeWrappedStats(
      [
        msg("a", "2026-01-01T09:00:00Z", "one"),
        msg("b", "2026-01-01T09:30:00Z", "two"),
        msg("b", "2026-01-02T20:00:00Z", "three"),
        msg("a", "2026-01-02T20:10:00Z", "four"),
      ],
      P,
      PERIOD,
      { sessionGapHours: 6 },
    );
    expect(s.initiation.sessions).toBe(2);
    const by = Object.fromEntries(s.initiation.byParticipant.map((x) => [x.id, x.starts]));
    expect(by).toEqual({ a: 1, b: 1 });
  });

  it("measures reply gaps only across a change of sender inside a session", () => {
    order = 0;
    const s = computeWrappedStats(
      [
        msg("a", "2026-01-01T09:00:00Z", "one"),
        msg("b", "2026-01-01T09:10:00Z", "two"),
        msg("b", "2026-01-01T09:12:00Z", "still me"),
        msg("a", "2026-01-01T09:42:00Z", "three"),
      ],
      P,
      PERIOD,
    );
    const b = s.replies.find((r) => r.id === "b")!;
    const a = s.replies.find((r) => r.id === "a")!;
    expect(b.replies).toBe(1);
    expect(b.medianReplyMinutes).toBe(10);
    expect(a.replies).toBe(1);
    expect(a.medianReplyMinutes).toBe(30);
  });

  it("excludes untimed messages from time-based figures but keeps them in totals", () => {
    order = 0;
    const s = computeWrappedStats(
      [msg("a", null, "no time"), msg("b", "2026-01-05T11:00:00Z", "timed")],
      P,
      PERIOD,
    );
    expect(s.totals.messages).toBe(2);
    expect(s.totals.withoutTime).toBe(1);
    expect(s.totals.activeDays).toBe(1);
    expect(s.busiest.day).toEqual({ key: "2026-01-05", count: 1 });
    expect(s.limitations.some((l) => l.includes("no readable timestamp"))).toBe(true);
  });

  it("ranks emojis deterministically", () => {
    order = 0;
    const s = computeWrappedStats(
      [msg("a", "2026-01-01T09:00:00Z", "😂😂🙂"), msg("b", "2026-01-01T09:01:00Z", "😂🙂")],
      P,
      PERIOD,
    );
    expect(s.emojis[0]).toEqual({ emoji: "😂", count: 3 });
    expect(s.emojis[1]).toEqual({ emoji: "🙂", count: 2 });
  });

  it("is reproducible for the same input", () => {
    order = 0;
    const input = [msg("a", "2026-01-01T09:00:00Z", "x"), msg("b", "2026-01-01T10:00:00Z", "y")];
    const one = computeWrappedStats(input, P, PERIOD);
    const two = computeWrappedStats(input, P, PERIOD);
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
  });

  it("assigns stable pseudonyms", () => {
    order = 0;
    const s = computeWrappedStats(
      [msg("a", "2026-01-01T09:00:00Z", "x"), msg("b", "2026-01-01T10:00:00Z", "y")],
      P,
      PERIOD,
    );
    expect(pseudonymMap(s)).toEqual({ a: "Person A", b: "Person B" });
  });
});

describe("availablePeriods", () => {
  it("offers only years, quarters and months the data covers", () => {
    order = 0;
    const periods = availablePeriods([
      msg("a", "2026-01-15T09:00:00Z", "x"),
      msg("b", "2026-05-02T09:00:00Z", "y"),
    ]);
    const labels = periods.map((p) => p.label);
    expect(labels).toContain("2026");
    expect(labels).toContain("Q1 2026");
    expect(labels).toContain("Q2 2026");
    expect(labels).not.toContain("Q4 2026");
    expect(labels).toContain("January 2026");
    expect(labels).toContain("May 2026");
    expect(labels).not.toContain("March 2026");
  });

  it("returns nothing when no message has a timestamp", () => {
    order = 0;
    expect(availablePeriods([msg("a", null, "x")])).toEqual([]);
  });
});
