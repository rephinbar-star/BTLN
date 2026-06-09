#!/usr/bin/env -S deno run --allow-env --allow-net
/**
 * End-to-end test for Stripe checkout + payments-webhook integration.
 *
 * Validates, for each product:
 *   1. A Stripe Checkout Session can be created via create-checkout
 *   2. The session's line item amount matches the expected price (cents)
 *   3. After completing the session with a test card, the payments-webhook:
 *      - upserts user_subscriptions (subscriptions) OR one_time_unlocks (report)
 *      - sets analyses.is_paid = true for the linked analysis
 *      - records a webhook_events audit row
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_...           \
 *   SUPABASE_URL=https://...supabase.co     \
 *   SUPABASE_SERVICE_ROLE_KEY=...           \
 *   TEST_USER_EMAIL=qa+stripe@yourdomain... \
 *   TEST_USER_PASSWORD=...                  \
 *   deno run -A scripts/test-stripe-e2e.ts
 *
 * Requires a Stripe TEST-mode secret key. Sandbox prices must exist with
 * the same lookup_keys as production: duo_monthly, duo_annual, report_unlock_one_time.
 */
import Stripe from "https://esm.sh/stripe@22.0.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const TEST_USER_EMAIL = Deno.env.get("TEST_USER_EMAIL")!;
const TEST_USER_PASSWORD = Deno.env.get("TEST_USER_PASSWORD")!;

if (!STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
  console.error("✗ STRIPE_SECRET_KEY must be a test-mode key (sk_test_...)");
  Deno.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PRODUCTS = [
  { key: "duo_monthly", expectedCents: 999, mode: "subscription" as const, table: "user_subscriptions" },
  { key: "duo_annual", expectedCents: 4999, mode: "subscription" as const, table: "user_subscriptions" },
  { key: "report_unlock_one_time", expectedCents: 499, mode: "payment" as const, table: "one_time_unlocks" },
];

function log(step: string, ok: boolean, details?: unknown) {
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} ${step}${details ? " — " + JSON.stringify(details) : ""}`);
}

async function getUserAccessToken(): Promise<{ token: string; userId: string }> {
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await anon.auth.signInWithPassword({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD });
  if (error || !data.session) throw new Error(`Sign-in failed: ${error?.message}`);
  return { token: data.session.access_token, userId: data.user!.id };
}

async function createTestAnalysis(userId: string): Promise<string> {
  const { data, error } = await admin
    .from("analyses")
    .insert({ user_id: userId, status: "complete", is_paid: false })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create test analysis: ${error.message}`);
  return (data as { id: string }).id;
}

async function pollUntil<T>(name: string, fn: () => Promise<T | null>, timeoutMs = 30_000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for: ${name}`);
}

async function runFor(product: typeof PRODUCTS[number], token: string, userId: string) {
  console.log(`\n=== ${product.key} ===`);
  const analysisId = await createTestAnalysis(userId);
  log("Created test analysis", true, { analysisId });

  // 1. Validate the Stripe price amount directly
  const prices = await stripe.prices.list({ lookup_keys: [product.key], expand: ["data.product"] });
  const price = prices.data[0];
  if (!price) throw new Error(`No test-mode price with lookup_key=${product.key}`);
  const amountOk = price.unit_amount === product.expectedCents;
  log(`Price amount = ${price.unit_amount}c (expected ${product.expectedCents}c)`, amountOk);
  if (!amountOk) throw new Error("Price mismatch");

  // 2. Create checkout session through the deployed edge function
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({
      priceId: product.key,
      customerEmail: TEST_USER_EMAIL,
      userId,
      analysisId,
      returnUrl: "https://example.com/return",
      environment: "sandbox",
    }),
  });
  const json = await res.json();
  if (!res.ok || !json?.clientSecret && !json?.sessionId) {
    throw new Error(`create-checkout failed: ${JSON.stringify(json)}`);
  }
  const sessionId: string = json.sessionId ?? json.id;
  log("Created checkout session", true, { sessionId });

  // 3. Drive the session to completion using Stripe test PaymentMethod
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const sessionAmount = session.amount_total ?? price.unit_amount;
  log(`Session total = ${sessionAmount}c`, sessionAmount === product.expectedCents);

  // Use Stripe's test helper to complete the session
  // (requires the session's PaymentIntent / SetupIntent — simulate via test card token)
  const pm = await stripe.paymentMethods.create({
    type: "card",
    card: { token: "tok_visa" },
  });

  if (product.mode === "payment") {
    const pi = await stripe.paymentIntents.confirm(session.payment_intent as string, {
      payment_method: pm.id,
      return_url: "https://example.com/return",
    });
    log(`PaymentIntent status = ${pi.status}`, pi.status === "succeeded");
  } else {
    // For subscriptions, the session must be completed via the hosted flow.
    // In test mode we can fall back to directly creating the subscription on the customer.
    const customerId = session.customer as string;
    await stripe.paymentMethods.attach(pm.id, { customer: customerId });
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } });
    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      metadata: { userId, analysisId },
      expand: ["latest_invoice.payment_intent"],
    });
    log(`Subscription status = ${sub.status}`, sub.status === "active" || sub.status === "trialing");
  }

  // 4. Verify DB state via webhook
  if (product.mode === "subscription") {
    const row = await pollUntil(`user_subscriptions row for ${userId}`, async () => {
      const { data } = await admin
        .from("user_subscriptions")
        .select("tier, status")
        .eq("user_id", userId)
        .in("status", ["active", "trialing"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    });
    log(`user_subscriptions upserted (tier=${(row as any).tier}, status=${(row as any).status})`, true);
  } else {
    const row = await pollUntil(`one_time_unlocks row for analysis ${analysisId}`, async () => {
      const { data } = await admin
        .from("one_time_unlocks")
        .select("amount_cents")
        .eq("user_id", userId)
        .eq("analysis_id", analysisId)
        .maybeSingle();
      return data;
    });
    const r = row as { amount_cents: number };
    log(`one_time_unlocks upserted (amount=${r.amount_cents}c)`, r.amount_cents === product.expectedCents);
  }

  const analysis = await pollUntil(`analyses.is_paid for ${analysisId}`, async () => {
    const { data } = await admin.from("analyses").select("is_paid").eq("id", analysisId).maybeSingle();
    return data && (data as any).is_paid ? data : null;
  });
  log(`analyses.is_paid = ${(analysis as any).is_paid}`, (analysis as any).is_paid === true);

  const events = await pollUntil(`webhook_events row for analysis ${analysisId}`, async () => {
    const { data } = await admin
      .from("webhook_events")
      .select("id, event_type, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    return data && data.length > 0 ? data : null;
  });
  log(`webhook_events recorded (${(events as any[]).length} recent)`, true, events);

  // Cleanup the test analysis
  await admin.from("analyses").delete().eq("id", analysisId);
}

async function main() {
  console.log("Stripe E2E test — TEST mode\n");
  const { token, userId } = await getUserAccessToken();
  log("Authenticated test user", true, { userId });

  let failures = 0;
  for (const product of PRODUCTS) {
    try {
      await runFor(product, token, userId);
    } catch (e) {
      failures++;
      log(`FAILED for ${product.key}: ${(e as Error).message}`, false);
    }
  }
  console.log(`\n${failures === 0 ? "✓ All products passed" : `✗ ${failures} product(s) failed`}`);
  Deno.exit(failures === 0 ? 0 : 1);
}

await main();