import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string | undefined> {
  if (!options.email && !options.userId) return undefined;
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const { priceId, quantity, customerEmail, userId: bodyUserId, analysisId, groupReadId, reportKind, customerCountry, returnUrl, environment } = body ?? {};


    // Derive userId from the verified JWT — never trust a body-supplied userId,
    // since it ends up in Stripe metadata and grants subscription/unlock access
    // in the webhook. Anonymous one-time checkouts (no Authorization header)
    // are still permitted, but with no userId attached.
    let userId: string | undefined;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { persistSession: false } },
      );
      const token = authHeader.replace("Bearer ", "");
      // The browser client always sends a Bearer header — it is the publishable
      // anon key when signed out. That token has no `sub`, so treat it as an
      // anonymous checkout rather than an error.
      const { data: userData } = await supabaseAuth.auth.getUser(token);
      const jwtUserId = userData?.user?.id ?? null;
      if (jwtUserId) {
        if (bodyUserId && bodyUserId !== jwtUserId) {
          return new Response(JSON.stringify({ error: "userId does not match authenticated user" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = jwtUserId;
      }
    }

    if (!priceId || typeof priceId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return new Response(JSON.stringify({ error: "Invalid priceId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!returnUrl || typeof returnUrl !== "string") {
      return new Response(JSON.stringify({ error: "Missing returnUrl" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (environment !== "sandbox" && environment !== "live") {
      return new Response(JSON.stringify({ error: "Invalid environment" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Explicit, validated report kind + owned target. A one-time purchase may
    // only ever target something the signed-in caller actually owns; the kind
    // is never inferred from the client's word alone.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let kind: "analysis" | "group_read" | null = null;
    if (reportKind !== undefined && reportKind !== null) {
      if (reportKind !== "analysis" && reportKind !== "group_read") {
        return new Response(JSON.stringify({ error: "Invalid reportKind" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      kind = reportKind;
    } else if (groupReadId) {
      kind = "group_read";
    } else if (analysisId) {
      kind = "analysis";
    }

    if (kind === "group_read") {
      if (!groupReadId || typeof groupReadId !== "string" || !UUID_RE.test(groupReadId)) {
        return new Response(JSON.stringify({ error: "Invalid groupReadId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!userId) {
        return new Response(JSON.stringify({ error: "Sign in to buy a single group report" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const { data: target } = await admin
        .from("group_reads")
        .select("id, user_id")
        .eq("id", groupReadId)
        .maybeSingle();
      if (!target || target.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Not your group read" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (kind === "analysis") {
      if (!analysisId || typeof analysisId !== "string" || !UUID_RE.test(analysisId)) {
        return new Response(JSON.stringify({ error: "Invalid analysisId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const { data: target } = await admin
        .from("analyses")
        .select("id, user_id")
        .eq("id", analysisId)
        .maybeSingle();
      if (!userId || !target || target.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Not your report" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const env: StripeEnv = environment;
    const stripe = createStripeClient(env);
    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    if (!prices.data.length) {
      return new Response(JSON.stringify({ error: "Price not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";
    if (kind === "group_read" && isRecurring) {
      return new Response(JSON.stringify({ error: "A group report purchase must be a one-time price" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const useManagedPayments = false; // disabled until Stripe head office address is set
    const customerId = await resolveOrCreateCustomer(stripe, { email: customerEmail, userId });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      ...(customerId && { customer: customerId }),
      metadata: {
        ...(userId && { userId }),
        ...(kind === "analysis" && analysisId && { analysisId }),
        ...(kind === "group_read" && { groupReadId }),
        ...(kind && { reportKind: kind }),
        ...(customerCountry && { customer_country: customerCountry }),
        managed_payments: useManagedPayments ? "true" : "false",
      },
      ...(isRecurring && userId && { subscription_data: { metadata: { userId, ...(analysisId && { analysisId }) } } }),
      ...(useManagedPayments ? { managed_payments: { enabled: true } } : {}),
    });


    return new Response(JSON.stringify({ clientSecret: session.client_secret }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("create-checkout error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});