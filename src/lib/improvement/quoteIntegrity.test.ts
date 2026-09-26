import { describe, expect, it } from "vitest";
import { enforceQuoteIntegrity, locateQuote } from "../../../supabase/functions/_shared/quoteIntegrity";

const msgs = [
  { speaker: "Casey", content: "I asked if you wanted to talk tonight and you didn’t answer." },
  { speaker: "Drew", content: "Sorry, work ran late. Can we do tomorrow?" },
  { speaker: "Casey", content: "My sister said \"he never calls back\" but I told her that's not fair." },
  { speaker: "Drew", content: "Tomorrow works, I promise I'll call at 7." },
];
const names = ["Casey", "Drew"];

describe("quotation integrity", () => {
  it("accepts exact and typography-normalised quotes", () => {
    expect(locateQuote("you didn't answer", msgs).ok).toBe(true);
    expect(locateQuote("Can we do   tomorrow?", msgs).ok).toBe(true);
    expect(locateQuote("I asked if you wanted to talk… you didn’t answer", msgs).ok).toBe(true);
  });
  it("rejects the invented line from the earlier run", () => {
    const r = { hidden_pattern: { description: "Drew withdraws. He wrote \"this conversation isn't worth my time.\" Casey keeps reaching out." } };
    const qi = enforceQuoteIntegrity(r, msgs, names);
    expect(qi.sentences_removed).toEqual([{ path: "hidden_pattern.description", reason: "not_in_source" }]);
    expect(r.hidden_pattern.description).toBe("Drew withdraws. Casey keeps reaching out.");
  });
  it("rejects model summary text dressed as a quote (no paraphrase repair)", () => {
    const r = { love_languages: { note: "Evidence is thin. \"Five messages contain no reliable signal of Casey's preference\" is all we can say." } };
    enforceQuoteIntegrity(r, msgs, names);
    expect(r.love_languages.note).toBe("Evidence is thin.");
    expect(r.love_languages.note).not.toContain("Five messages");
  });
  it("rejects stitched quotes across messages", () => {
    expect(locateQuote("work ran late ... I'll call at 7", msgs)).toEqual({ ok: false, reason: "stitched" });
  });
  it("rejects wrong speaker on structured quotes", () => {
    const r = { green_flags: [{ speaker: "Casey", quote: "Tomorrow works, I promise I'll call at 7." }] };
    const qi = enforceQuoteIntegrity(r, msgs, names);
    expect(qi.sentences_removed[0].reason).toBe("wrong_speaker");
  });
  it("third-party text quoted inside a message belongs to that message's sender", () => {
    const ok = { yellow_flags: [{ speaker: "Casey", quote: "he never calls back" }] };
    expect(enforceQuoteIntegrity(ok, msgs, names).quotes_supported).toBe(1);
    const bad = { yellow_flags: [{ speaker: "Drew", quote: "he never calls back" }] };
    expect(enforceQuoteIntegrity(bad, msgs, names).sentences_removed[0].reason).toBe("wrong_speaker");
  });
  it("leaves advice example replies untouched", () => {
    const r = { communication_suggestions: { person1: "Try saying \"I miss hearing from you in the evenings.\"" } };
    const qi = enforceQuoteIntegrity(r, msgs, names);
    expect(qi.quotes_checked).toBe(0);
    expect(r.communication_suggestions.person1).toContain("I miss hearing");
  });
  it("removes exact repeated sentences but keeps the first qualified copy", () => {
    const s = "This may reflect scheduling pressure rather than disinterest.";
    const r = { headline: s, hidden_pattern: { description: `${s} Casey asked directly.` } };
    const qi = enforceQuoteIntegrity(r, msgs, names);
    expect(qi.duplicate_sentences_removed).toBe(1);
    expect(r.headline).toBe(s);
    expect(r.hidden_pattern.description).toBe("Casey asked directly.");
  });
  it("flags unsafe when most quotes are unsupported", () => {
    const r = { a: "\"one two three four five\". \"six seven eight nine ten\". \"eleven twelve thirteen\". \"you didn't answer\"." };
    expect(enforceQuoteIntegrity(r, msgs, names).unsafe).toBe(true);
  });
});
