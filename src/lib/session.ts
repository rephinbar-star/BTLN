import { supabase } from "@/integrations/supabase/client";

const KEY = "chemistry_session_id";

const uuidv4 = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const getSessionId = (): string => {
  if (typeof window === "undefined") return uuidv4();
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = uuidv4();
    window.localStorage.setItem(KEY, id);
  }
  return id;
};

export const logEvent = (
  event_name: string,
  metadata: Record<string, unknown> = {},
): void => {
  try {
    const session_id = getSessionId();
    // Fire-and-forget — never await, never throw
    void supabase.from("events").insert({ session_id, event_name, metadata });
  } catch {
    // swallow
  }
};