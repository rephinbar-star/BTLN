import type { CanonicalConversation } from "@/lib/ingest/canonical";
import { parsedFromCanonical } from "@/lib/ingest/canonical";
import { mergeParticipants } from "./parse";

export function renameReviewedParticipant(conversation: CanonicalConversation, id: string, name: string): CanonicalConversation {
  const previous = conversation.participants.find((person) => person.id === id)?.display_name;
  return { ...conversation, participants: conversation.participants.map((person) => person.id === id ? { ...person, display_name: name } : person), messages: conversation.messages.map((message) => message.participant_id === id && message.raw_sender === previous ? { ...message, raw_sender: name } : message) };
}

export function mergeReviewedParticipants(conversation: CanonicalConversation, intoId: string, fromId: string): CanonicalConversation {
  const merged = mergeParticipants({ ...parsedFromCanonical(conversation), format: "attributed_text" }, intoId, fromId);
  return {
    ...conversation,
    participants: merged.participants,
    messages: conversation.messages.map((message) => message.participant_id === fromId ? { ...message, participant_id: intoId, raw_sender: merged.participants.find((person) => person.id === intoId)?.display_name ?? message.raw_sender, provenance: { ...message.provenance, confidence: "confirmed" } } : message),
  };
}
