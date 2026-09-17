import { describe, expect, it } from "vitest";
import { deepResult, groupResult, groupRoastResult } from "./fixtures";
import { calculatedWrappedExample, groupMessages, pairMessages, wrappedMessages } from "./sourceFixtures";

const texts = (messages: { text: string }[]) => messages.map((message) => message.text);
describe("fictional sample sources", () => {
  it("keeps evidence and counts grounded in complete visible fixtures", () => {
    expect(deepResult.coverage?.messages_supplied).toBe(pairMessages.length);
    expect(groupResult.coverage?.messages_supplied).toBe(groupMessages.length);
    expect(groupRoastResult.coverage?.messages_supplied).toBe(groupMessages.length);
    for (const role of groupResult.role_cards ?? []) expect(texts(groupMessages)).toContain(role.evidence);
    for (const role of groupRoastResult.participant_roles ?? []) expect(texts(groupMessages)).toContain(role.evidence);
  });
  it("derives Wrapped values from every displayed source message", () => {
    expect(calculatedWrappedExample.totals.messages).toBe(wrappedMessages.length);
    expect(calculatedWrappedExample.totals.attachments).toBe(1);
    expect(calculatedWrappedExample.participants.map((person) => person.messages)).toEqual([6, 6]);
  });
});
