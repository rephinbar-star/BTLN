import { describe, expect, it } from "vitest";
import { describeSource } from "./sourceCoverage";

const base = { id: "s", source_kind: "deep_read", dated_count: null, undated_count: null, date_provenance: "unknown", date_precision: "unknown", observed_period_start: null, observed_period_end: null };

describe("describeSource", () => {
  it("10k parsed source: full supplied range, recent-400 attribution only", () => {
    const d = describeSource({ ...base, dated_count: 10000, undated_count: 0, date_provenance: "parsed", date_precision: "date", observed_period_start: "2024-01-01T00:00:00+00:00", observed_period_end: "2024-12-13T00:00:00+00:00" }, 12);
    expect(d.count).toBe("10,000 messages supplied");
    expect(d.dates).toBe("Jan 1, 2024 – Dec 13, 2024 (from message dates)");
    expect(d.attribution).toMatch(/most recent 400 only/);
    expect(d.used).toBe("12 stored observations");
  });
  it("small, undated and self-reported fallbacks", () => {
    expect(describeSource({ ...base, dated_count: 0, undated_count: 30 }, 1).attribution).toBe("Speakers checked closely in all 30");
    const u = describeSource(base, 0);
    expect(u.count).toBe("Message count not recorded");
    expect(u.dates).toBe("Dates unknown");
    expect(u.attribution).toBeNull();
    const s = describeSource({ ...base, source_kind: "quick_take", dated_count: 10, undated_count: 0, date_provenance: "user_supplied", observed_period_start: "2023-03-01T00:00:00Z", observed_period_end: "2023-06-30T00:00:00Z" }, 2);
    expect(s.dates).toBe("Mar 1, 2023 – Jun 30, 2023 (period you entered)");
    expect(s.attribution).toBeNull();
  });
});
