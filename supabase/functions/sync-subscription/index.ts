import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function resolveTier(lookupKey?: string | null): string {
  if (lookupKey === "duo_annual") return "annual";
  if (lookupKey === "duo_monthly") return "monthly";
  return lookupKey ?? "unknown";
}

function isAccessGrantingStatus(status?: string | null): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

function isoFromUnix(seconds?: number | null): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function syncSubscription(subscription: any, analysisId?: string | null) {
  const userId = subscription.metadata?.userId;
  if (!userId) return false;

  const item = subscription.items?.data?.[0];
  const lookupKey = item?.price?.lookup_key ?? item?.price?.metadata?.lovable_external_id ?? item?.price?.id ?? null;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const { error } = await supabase.from("user_subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
      tier: resolveTier(lookupKey),
      status: subscription.status,
      current_period_start: isoFromUnix(periodStart),
      current_period_end: isoFromUnix(periodEnd),
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) throw new Error(error.message);

  const reportId = analysisId ?? subscription.metadata?.analysisId;
  if (reportId && isAccessGrantingStatus(subscription.status)) {
    await supabase
      .from("analyses")
      .update({ is_paid: true })
      .eq("id", reportId)
      .eq("user_id", userId);
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const { environment, analysisId } = body ?? {};
    if (environment !== "sandbox" && environment !== "live") {
      return new Response(JSON.stringify({ error: "Invalid environment" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripe = createStripeClient(environment as StripeEnv);
    const synced = new Set<string>();
    const subscriptions = await stripe.subscriptions.search({
      query: `metadata['userId']:'${user.id}'`,
      limit: 10,
    });
    for (const sub of subscriptions.data) {
      if (await syncSubscription(sub, analysisId)) synced.add(sub.id);
    }

    if (synced.size === 0 && user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 10 });
      for (const customer of customers.data) {
        const list = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 10 });
        for (const sub of list.data) {
          if (sub.metadata?.userId === user.id && await syncSubscription(sub, analysisId)) {
            synced.add(sub.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ synced: synced.size }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("sync-subscription error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});