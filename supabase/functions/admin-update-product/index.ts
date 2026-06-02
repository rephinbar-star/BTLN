import { createStripeClient } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
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