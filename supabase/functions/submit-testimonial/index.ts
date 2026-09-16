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
  try {
    const body = await req.json();
    const analysisId = String(body.analysis_id ?? "");
    const sessionId = String(body.session_id ?? "");
    const quote = String(body.quote ?? "").trim();
    const attribution = String(body.attribution ?? "Anonymous").trim() || "Anonymous";
    if (!UUID_RE.test(analysisId) || !UUID_RE.test(sessionId)) return json(400, { error: "Invalid report" });
    if (body.publication_consent !== true) return json(400, { error: "Publication consent is required" });
    if (!quote || quote.length > 1000 || attribution.length > 80) return json(400, { error: "Invalid feedback details" });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      const { data } = await admin.auth.getUser(authHeader.slice(7));
      userId = data.user?.id ?? null;
    }
    const { data: report } = await admin
      .from("analyses")
      .select("id,user_id,session_id,status")
      .eq("id", analysisId)
      .maybeSingle();
    const owns = report?.status === "complete" && (report.user_id ? report.user_id === userId : report.session_id === sessionId);
    if (!owns) return json(403, { error: "Not authorized for this report" });

    const { data, error } = await admin.from("testimonial_candidates").upsert({
      analysis_id: analysisId,
      user_id: userId,
      session_id: sessionId,
      quote,
      attribution,
      publication_consent: true,
      consented_at: new Date().toISOString(),
      moderation_status: "pending",
      moderated_at: null,
      is_test: false,
    }, { onConflict: "analysis_id,session_id" }).select("id").single();
    if (error) throw error;
    return json(200, { saved: true, id: data.id });
  } catch (error) {
    console.error("submit-testimonial error", error instanceof Error ? error.message : "unknown");
    return json(500, { error: "Could not save publication consent" });
  }
});
