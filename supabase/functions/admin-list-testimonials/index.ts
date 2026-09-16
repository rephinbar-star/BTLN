import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json().catch(() => ({}));
    const expected = Deno.env.get("ADMIN_PASSWORD") ?? "";
    
    if (!expected) return json({ ok: false, error: "ADMIN_PASSWORD not configured" }, 500);
    if (typeof password !== "string" || password !== expected) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await admin
      .from("testimonial_candidates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return json({
      ok: true,
      data
    });
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
