import { corsHeaders } from "@supabase/supabase-js/cors";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const MANAGED_PAYMENTS_COUNTRIES = new Set([
  "US","CA","BR","CL","CO","AR","PE","UY",
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT",
  "LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
  "GB","NO","CH","IS","LI",
  "AU","NZ","KR","MY","TH","ID","PH","VN","IN","HK","TW",
  "AE","SA","ZA","IL","TR","EG","NG","KE",
  "GI","BH","GE","KZ","BD","PK","LK","MM","KH","LA",
  "RS","BA","ME","MK","AL","MD","AM",
]);

function shouldUseComplianceHandling(country?: string): boolean {
  if (!country) return false;
  return MANAGED_PAYMENTS_COUNTRIES.has(country.toUpperCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const { priceId, quantity, customerEmail, userId, analysisId, customerCountry, returnUrl, environment } = body ?? {};
    if (!priceId || typeof priceId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return new Response(JSON.stringify({ error: "Invalid priceId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!returnUrl || typeof returnUrl !== "string") {
      return new Response(JSON.stringify({ error: "Missing returnUrl" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (environment !== "sandbox" && environment !== "live") {
      return new Response(JSON.stringify({ error: "Invalid environment" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const env: StripeEnv = environment;
    const stripe = createStripeClient(env);
    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    if (!prices.data.length) {
      return new Response(JSON.stringify({ error: "Price not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";
    const useManagedPayments = shouldUseComplianceHandling(customerCountry);

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      ...(customerEmail && { customer_email: customerEmail }),
      metadata: {
        ...(userId && { userId }),
        ...(analysisId && { analysisId }),
        ...(customerCountry && { customer_country: customerCountry }),
        managed_payments: useManagedPayments ? "true" : "false",
      },
      ...(isRecurring && userId && { subscription_data: { metadata: { userId, ...(analysisId && { analysisId }) } } }),
      ...(useManagedPayments ? { managed_payments: { enabled: true } } : { automatic_tax: { enabled: true } }),
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("create-checkout error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});