import { describe, expect, it } from "vitest";
import { adaptInteractiveEvent, adaptQuickTake } from "../../../supabase/functions/_shared/r360Adapters.ts";
import {
  conversationKey,
  deriveDateMeta,
  deriveDateMetaFromText,
} from "../../../supabase/functions/_shared/exchangeDates.ts";

const quickTakeResult = { verdict: "Mixed", read: "They answered late and changed the subject." };

describe("exchange dates", () => {
  it("reads a real range from an export and counts what carried no date", () => {
    const meta = deriveDateMetaFromText(
      [
        "[12/03/2026, 09:14:02] Taylor: morning",
        "[14/03/2026, 21:02:11] Alex: sorry, busy week",
        "a line with no date at all",
      ].join("\n"),
    );
    expect(meta.observed_start).toBe("2026-03-12");
    expect(meta.observed_end).toBe("2026-03-14");
    expect(meta.dated_count).toBe(2);
    expect(meta.undated_count).toBe(1);
    expect(meta.date_provenance).toBe("parsed");
  });

  it("flags day/month ambiguity instead of inventing certainty", () => {
    const meta = deriveDateMetaFromText("[02/03/2026, 09:14] Taylor: hi\n[04/03/2026, 10:00] Alex: hey");
    expect(meta.date_note).toContain("Day and month order");
  });

  it("keeps unknown unknown when nothing is dated", () => {
    const meta = deriveDateMetaFromText("Taylor: hi\nAlex: hey");
    expect(meta.observed_start).toBeNull();
    expect(meta.date_precision).toBe("unknown");
    expect(meta.date_provenance).toBe("unknown");
  });

  it("never accepts a future date", () => {
    const year = new Date().getUTCFullYear() + 3;
    const meta = deriveDateMetaFromText(`[01/01/${year}, 09:00] Taylor: hi`);
    expect(meta.observed_start).toBeNull();
  });

  it("derives a range from message timestamps", () => {
    const meta = deriveDateMeta(
      [
        { order: 0, ts: "2026-01-05T10:00:00Z", content: "a" },
        { order: 1, ts: null, content: "b" },
        { order: 2, ts: "2026-01-09T10:00:00Z", content: "c" },
      ],
      "ocr_confirmed",
    );
    expect(meta.observed_start).toBe("2026-01-05");
    expect(meta.observed_end).toBe("2026-01-09");
    expect(meta.undated_count).toBe(1);
    expect(meta.date_provenance).toBe("ocr_confirmed");
  });

  it("mints a conversation key only for an identical transcript, not a similar one", async () => {
    const messages = Array.from({ length: 8 }, (_, order) => ({
      order,
      raw_sender: order % 2 ? "Alex" : "Taylor",
      ts: null,
      content: `message number ${order} with enough text to matter`,
    }));
    const key = await conversationKey(messages);
    expect(key).toMatch(/^tx:/);
    expect(await conversationKey([...messages].reverse())).toBe(key);
    const edited = messages.map((m, index) => (index === 3 ? { ...m, content: `${m.content}!` } : m));
    expect(await conversationKey(edited)).not.toBe(key);
    expect(await conversationKey(messages.slice(0, 3))).toBeNull();
  });
});

describe("observation dates", () => {
  it("does not date a claim from a report spanning a long stretch", () => {
    const drafts = adaptQuickTake(quickTakeResult, {
      subject: "Taylor",
      label: "Quick Take",
      observedStart: "2024-01-01",
      observedEnd: "2026-01-01",
    });
    expect(drafts.length).toBeGreaterThan(0);
    for (const draft of drafts) expect(draft.observed_period_start).toBeNull();
  });

  it("keeps the dates of a short, genuinely dated report", () => {
    const drafts = adaptQuickTake(quickTakeResult, {
      subject: "Taylor",
      label: "Quick Take",
      observedStart: "2026-03-01",
      observedEnd: "2026-03-10",
    });
    expect(drafts[0].observed_period_start).toBe("2026-03-01");
  });

  it("gives a later exchange its own date and never inherits the original period", () => {
    const ctx = { subject: "Taylor", label: "Quick Take", observedStart: "2026-03-01", observedEnd: "2026-03-05" };
    const undated = adaptInteractiveEvent({ event_type: "sent_reply", result_json: {}, provenance: {} }, ctx);
    expect(undated[0].observed_period_start).toBeNull();

    const dated = adaptInteractiveEvent(
      { event_type: "sent_reply", result_json: {}, provenance: { exchange_date: "2026-06-20" } },
      ctx,
    );
    expect(dated[0].observed_period_start).toBe("2026-06-20");
  });
});
