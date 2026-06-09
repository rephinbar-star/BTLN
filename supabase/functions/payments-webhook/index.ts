import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  }
  return _supabase;
}

function resolveTier(lookupKey?: string | null): string {
  if (lookupKey === "duo_annual") return "annual";
  if (lookupKey === "duo_monthly") return "monthly";
  return lookupKey ?? "unknown";
}

function isAccessGrantingStatus(status?: string | null): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

async function unlockAnalysisForUser(analysisId?: string | null, userId?: string | null) {
  if (!analysisId || !userId) return;
  const { error } = await getSupabase()
    .from("analyses")
    .update({ is_paid: true })
    .eq("id", analysisId)
    .eq("user_id", userId);
  if (error) console.error("analyses subscription unlock error:", error.message);
}

async function logWebhookEvent(eventName: string, metadata: Record<string, unknown>) {
  try {
    await getSupabase()
      .from("events")
      // session_id is required (uuid) — use the all-zero uuid for server-side events.
      .insert({ session_id: "00000000-0000-0000-0000-000000000000", event_name: eventName, metadata });
  } catch (e) {
    console.error("events log failed:", (e as Error).message);
  }
}

type AuditEntry = {
  environment: string;
  event_id?: string | null;
  event_type: string;
  checkout_session_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  user_id?: string | null;
  analysis_id?: string | null;
  amount_cents?: number | null;
  status?: string;
  changes?: Record<string, unknown>;
  error_message?: string | null;
  payload_summary?: Record<string, unknown>;
};

async function recordAudit(entry: AuditEntry) {
  try {
    await getSupabase().from("webhook_events").insert({
      provider: "stripe",
      environment: entry.environment,
      event_id: entry.event_id ?? null,
      event_type: entry.event_type,
      checkout_session_id: entry.checkout_session_id ?? null,
      stripe_customer_id: entry.stripe_customer_id ?? null,
      stripe_subscription_id: entry.stripe_subscription_id ?? null,
      user_id: entry.user_id ?? null,
      analysis_id: entry.analysis_id ?? null,
      amount_cents: entry.amount_cents ?? null,
      status: entry.status ?? "processed",
      changes: entry.changes ?? {},
      error_message: entry.error_message ?? null,
      payload_summary: entry.payload_summary ?? {},
    });
  } catch (e) {
    console.error("webhook_events insert failed:", (e as Error).message);
  }
}

async function handleCheckoutCompleted(session: any, env: StripeEnv, eventId: string) {
  const userId = session.metadata?.userId;
  const analysisId = session.metadata?.analysisId;
  const mode = session.mode; // 'payment' | 'subscription'

  // One-time unlock — only applies to payment mode.
  if (mode === "payment") {
    if (!userId || !analysisId) {
      console.log("checkout.session.completed (payment) missing metadata", { session_id: session.id });
      await recordAudit({
        environment: env,
        event_id: eventId,
        event_type: "checkout.session.completed",
        checkout_session_id: session.id,
        status: "skipped",
        error_message: "Missing userId or analysisId metadata",
        payload_summary: { mode, amount_total: session.amount_total },
      });
      return;
    }
    const amount = session.amount_total ?? 0;
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
    const { error: insertError } = await getSupabase().from("one_time_unlocks").upsert(
      {
        user_id: userId,
        analysis_id: analysisId,
        amount_cents: amount,
        stripe_payment_intent_id: paymentIntent,
      },
      { onConflict: "user_id,analysis_id" },
    );
    if (insertError) console.log("one_time_unlocks insert error:", insertError.message);
    await unlockAnalysisForUser(analysisId, userId);
    await recordAudit({
      environment: env,
      event_id: eventId,
      event_type: "checkout.session.completed",
      checkout_session_id: session.id,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      user_id: userId,
      analysis_id: analysisId,
      amount_cents: amount,
      status: insertError ? "error" : "processed",
      error_message: insertError?.message ?? null,
      changes: {
        one_time_unlocks: insertError ? "failed" : "upserted",
        analyses_is_paid: insertError ? false : true,
      },
      payload_summary: { mode, payment_intent: paymentIntent, amount_total: amount },
    });
    return;
  }

  // Subscription rows are written by customer.subscription.* events, but
  // checkout completion can arrive first. Unlock this report immediately.
  if (mode === "subscription") {
    await unlockAnalysisForUser(analysisId, userId);
    await recordAudit({
      environment: env,
      event_id: eventId,
      event_type: "checkout.session.completed",
      checkout_session_id: session.id,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
      user_id: userId ?? null,
      analysis_id: analysisId ?? null,
      amount_cents: session.amount_total ?? null,
      status: "processed",
      changes: { analyses_is_paid: analysisId && userId ? true : false },
      payload_summary: { mode, amount_total: session.amount_total },
    });
  }
}

async function handleSubscriptionUpsert(subscription: any, env: StripeEnv, eventId: string, eventType: string) {
  const userId = subscription.metadata?.userId;
  const analysisId = subscription.metadata?.analysisId;
  if (!userId) {
    console.log("subscription event missing userId metadata", { sub: subscription.id });
    await recordAudit({
      environment: env,
      event_id: eventId,
      event_type: eventType,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      status: "skipped",
      error_message: "Missing userId metadata",
      payload_summary: { status: subscription.status },
    });
    return;
  }
  const item = subscription.items?.data?.[0];
  const lookupKey = item?.price?.lookup_key ?? item?.price?.metadata?.lovable_external_id ?? item?.price?.id ?? null;
  const tier = resolveTier(lookupKey);
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const { error } = await getSupabase().from("user_subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      tier,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) console.error("user_subscriptions upsert error:", error.message);
  if (!error && isAccessGrantingStatus(subscription.status)) {
    await unlockAnalysisForUser(analysisId, userId);
  }
  await recordAudit({
    environment: env,
    event_id: eventId,
    event_type: eventType,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer,
    user_id: userId,
    analysis_id: analysisId ?? null,
    amount_cents: item?.price?.unit_amount ?? null,
    status: error ? "error" : "processed",
    error_message: error?.message ?? null,
    changes: {
      user_subscriptions: error ? "failed" : "upserted",
      tier,
      status: subscription.status,
      analyses_is_paid: !error && isAccessGrantingStatus(subscription.status) && analysisId ? true : false,
    },
    payload_summary: {
      lookup_key: lookupKey,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    },
  });
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv, eventId: string) {
  const { error } = await getSupabase()
    .from("user_subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id);
  if (error) console.error("user_subscriptions cancel error:", error.message);
  await recordAudit({
    environment: env,
    event_id: eventId,
    event_type: "customer.subscription.deleted",
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer,
    user_id: subscription.metadata?.userId ?? null,
    status: error ? "error" : "processed",
    error_message: error?.message ?? null,
    changes: { user_subscriptions: error ? "failed" : "canceled" },
    payload_summary: { status: "canceled" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Webhook invalid env:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  try {
    const event = await verifyWebhook(req, rawEnv);
    await logWebhookEvent("stripe_webhook_received", { type: event.type, env: rawEnv });
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, rawEnv, event.id);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(event.data.object, rawEnv, event.id, event.type);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, rawEnv, event.id);
        break;
      case "invoice.payment_failed":
        await logWebhookEvent("stripe_payment_failed", {
          invoice_id: (event.data.object as any)?.id,
          customer: (event.data.object as any)?.customer,
          subscription: (event.data.object as any)?.subscription,
        });
        await recordAudit({
          environment: rawEnv,
          event_id: event.id,
          event_type: event.type,
          stripe_customer_id: (event.data.object as any)?.customer,
          stripe_subscription_id: (event.data.object as any)?.subscription,
          status: "processed",
          changes: {},
          payload_summary: { invoice_id: (event.data.object as any)?.id },
        });
        break;
      default:
        console.log("Unhandled event:", event.type);
        await recordAudit({
          environment: rawEnv,
          event_id: event.id,
          event_type: event.type,
          status: "ignored",
          payload_summary: {},
        });
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});