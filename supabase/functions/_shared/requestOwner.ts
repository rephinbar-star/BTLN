import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveOwnerWith, type OwnerResolution } from "./requestOwnerCore.ts";

export type { OwnerResolution };

/** Validates the caller's bearer token with the auth server (current SDK). */
export const resolveRequestOwner = (req: Request): Promise<OwnerResolution> => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const publishable = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const admin = createClient(url, service, { auth: { persistSession: false } });
  return resolveOwnerWith(req.headers.get("Authorization"), [anon, publishable].filter(Boolean), async (token) => {
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data?.user?.id ?? null;
  });
};
