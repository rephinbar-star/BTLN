import { createStripeClient } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
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
    const { lookupKey, name, description, environment } = await req.json();
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