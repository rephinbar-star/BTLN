import { createStripeClient } from "../_shared/stripe.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

async function requireAdmin(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  const userId = (claimsData?.claims?.sub as string) ?? null;
  if (claimsErr || !userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleErr || !isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

Deno.serve(async (req) => {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("list") === "1") {
    try {
      const environment = (url.searchParams.get("env") ?? "sandbox") as "sandbox" | "live";
      const stripe = createStripeClient(environment);
      const products = await stripe.products.list({ limit: 100, active: true });
      const prices = await stripe.prices.list({ limit: 100, active: true });
      const out = products.data.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        active: p.active,
        prices: prices.data
          .filter((pr) => (typeof pr.product === "string" ? pr.product : pr.product.id) === p.id)
          .map((pr) => ({
            id: pr.id,
            lookup_key: pr.lookup_key,
            unit_amount: pr.unit_amount,
            currency: pr.currency,
            type: pr.type,
            recurring: pr.recurring ? { interval: pr.recurring.interval } : null,
          })),
      }));
      return new Response(JSON.stringify({ products: out }, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = await req.json();
    const { action, lookupKey, name, description, environment } = body;

    // Ensure a price with the given lookup key exists in the mode of the
    // configured STRIPE_SECRET_KEY (sk_live_* => live mode). Idempotent.
    if (action === "ensure_price") {
      const {
        unitAmount,
        currency = "usd",
        interval,
        productName,
        productDescription,
      } = body;
      if (!lookupKey || typeof unitAmount !== "number" || unitAmount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
      }
      const stripe = createStripeClient("live");
      const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
      if (existing.data.length) {
        const p = existing.data[0];
        return new Response(
          JSON.stringify({
            ok: true,
            created: false,
            price: { id: p.id, livemode: p.livemode, lookup_key: p.lookup_key, unit_amount: p.unit_amount },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      const product = await stripe.products.create({
        name: productName ?? lookupKey,
        ...(productDescription ? { description: productDescription } : {}),
      });
      const price = await stripe.prices.create({
        product: product.id,
        currency,
        unit_amount: unitAmount,
        lookup_key: lookupKey,
        transfer_lookup_key: true,
        ...(interval ? { recurring: { interval } } : {}),
      });
      return new Response(
        JSON.stringify({
          ok: true,
          created: true,
          price: { id: price.id, livemode: price.livemode, lookup_key: price.lookup_key, unit_amount: price.unit_amount },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    if (!lookupKey || (environment !== "sandbox" && environment !== "live")) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
    }
    const stripe = createStripeClient(environment);
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], expand: ["data.product"] });
    if (!prices.data.length) {
      return new Response(JSON.stringify({ error: "Price not found" }), { status: 404 });
    }
    const price = prices.data[0];
    const productId = typeof price.product === "string" ? price.product : price.product.id;
    const updated = await stripe.products.update(productId, {
      ...(name && { name }),
      ...(description !== undefined && { description }),
    });
    return new Response(JSON.stringify({ ok: true, product: { id: updated.id, name: updated.name, description: updated.description } }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});