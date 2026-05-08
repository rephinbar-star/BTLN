import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  }
  return _supabase;
}

async function handleCheckoutCompleted(session: any, _env: StripeEnv) {
  const userId = session.metadata?.userId;
  const analysisId = session.metadata?.analysisId;
  const amount = session.amount_total ?? 0;
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  if (!userId || !analysisId) {
    console.log("checkout.session.completed missing metadata", { session_id: session.id });
    return;
  }
  const { error: insertError } = await getSupabase().from("one_time_unlocks").insert({
    user_id: userId,
    analysis_id: analysisId,
    amount_cents: amount,
    stripe_payment_intent_id: paymentIntent,
  });
  if (insertError) console.log("one_time_unlocks insert error:", insertError.message);
  const { error: updateError } = await getSupabase().from("analyses").update({ is_paid: true }).eq("id", analysisId);
  if (updateError) console.error("analyses update is_paid error:", updateError.message);
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
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object, rawEnv);
    } else {
      console.log("Unhandled event:", event.type);
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});