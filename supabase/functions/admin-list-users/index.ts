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
    const { password } = await req.json().catch(() => ({ password: "" }));
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

    // Pull auth users (paginated). 1000 is sufficient for this admin view.
    const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authErr) return json({ ok: false, error: authErr.message }, 500);

    const users = authData.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }));
    const userIds = users.map((u) => u.id);

    const [profilesRes, analysesRes, subsRes, unlocksRes, surveysRes] = await Promise.all([
      admin.from("profiles").select("user_id, display_name").in("user_id", userIds),
      admin
        .from("analyses")
        .select("id, user_id, status, created_at, context_data, result_json, is_paid")
        .in("user_id", userIds)
        .order("created_at", { ascending: false }),
      admin
        .from("user_subscriptions")
        .select(
          "user_id, status, tier, current_period_end, cancel_at_period_end, stripe_subscription_id, created_at",
        )
        .in("user_id", userIds),
      admin
        .from("one_time_unlocks")
        .select("user_id, analysis_id, amount_cents, stripe_payment_intent_id, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false }),
      admin
        .from("survey_responses")
        .select("user_id, accuracy_rating, question_variant, feedback_text, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false }),
    ]);

    return json({
      ok: true,
      users,
      profiles: profilesRes.data ?? [],
      analyses: analysesRes.data ?? [],
      subscriptions: subsRes.data ?? [],
      unlocks: unlocksRes.data ?? [],
      surveys: surveysRes.data ?? [],
    });
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});