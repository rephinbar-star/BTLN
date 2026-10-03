import type { CanonicalConversation } from "@/lib/ingest/canonical";
import { parsedFromCanonical } from "@/lib/ingest/canonical";
import { mergeParticipants } from "./parse";

export function renameReviewedParticipant(conversation: CanonicalConversation, id: string, name: string): CanonicalConversation {
  return { ...conversation, participants: conversation.participants.map((person) => person.id === id ? { ...person, display_name: name } : person) };
}

export function mergeReviewedParticipants(conversation: CanonicalConversation, intoId: string, fromId: string): CanonicalConversation {
  const merged = mergeParticipants({ ...parsedFromCanonical(conversation), format: "attributed_text" }, intoId, fromId);
  return {
    ...conversation,
    participants: merged.participants,
    messages: conversation.messages.map((message) => message.participant_id === fromId ? { ...message, participant_id: intoId, provenance: { ...message.provenance, confidence: "confirmed" } } : message),
  };
}
