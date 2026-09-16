import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const body = await req.json().catch(() => ({}));
  const expected = Deno.env.get("ADMIN_PASSWORD") ?? "";
  if (!expected || body.password !== expected) return json(403, { error: "Forbidden" });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  if (body.action === "list") {
    const { data, error } = await admin.from("testimonial_candidates")
      .select("id,quote,attribution,publication_consent,moderation_status,is_test,created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) return json(500, { error: "Could not load feedback" });
    return json(200, { candidates: data ?? [] });
  }
  if (body.action === "moderate" && UUID_RE.test(String(body.id ?? "")) && ["approved", "rejected", "pending"].includes(body.status)) {
    const { error } = await admin.from("testimonial_candidates").update({
      moderation_status: body.status,
      moderated_at: body.status === "pending" ? null : new Date().toISOString(),
    }).eq("id", body.id).eq("publication_consent", true).eq("is_test", false);
    if (error) return json(500, { error: "Could not update feedback" });
    return json(200, { updated: true });
  }
  return json(400, { error: "Invalid request" });
});
