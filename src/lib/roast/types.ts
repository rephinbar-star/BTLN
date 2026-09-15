export type RoastTone = "playful" | "gentle";

export type RoastSubject = { id: string; display_name: string };

export type RoastResultJson = {
  headline?: string;
  observations?: { subject_id?: string; text?: string }[];
  receipt?: { quote?: string; note?: string } | null;
  closing?: string;
  seriously?: string[];
  subjects?: RoastSubject[];
  source_type?: "analysis" | "group_read";
  source_category?: string;
  tone?: RoastTone;
  safety_mode?: boolean;
  safety_reason?: string | null;
  message?: string;
};

export type RoastShareSnapshot = {
  v: number;
  context: string;
  category: string;
  headline: string;
  observations: { label: string; text: string }[];
  receipt: { quote: string; note: string } | null;
  closing: string;
  seriously: string[];
  include_names: boolean;
  include_quotes: boolean;
  created_at: string;
};

export const ROAST_SOURCE_LABEL: Record<string, string> = {
  analysis: "Deep Read",
  group_read: "Group Read",
};

/** SHA-256 of the raw token; only the hash ever reaches the server. */
export async function hashRoastShareToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
