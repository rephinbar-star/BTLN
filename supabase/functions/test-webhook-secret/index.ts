import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function computeExpected(secret: string, timestamp: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return new TextDecoder().decode(encode(new Uint8Array(signed)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const { adminPassword, payload, signature, env, secretName } = await req.json();

    // Admin gate — same shape as verify-admin-password.
    const expectedPwd = Deno.env.get("ADMIN_PASSWORD") ?? "";
    if (!expectedPwd || adminPassword !== expectedPwd) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    if (typeof payload !== "string" || typeof signature !== "string") {
      return json({ ok: false, error: "payload and signature are required strings" }, 400);
    }

    // Resolve which secret to test against.
    // Priority: explicit secretName → env-specific (sandbox/live) → fallback.
    const candidateNames: string[] = [];
    if (typeof secretName === "string" && secretName.length > 0) {
      candidateNames.push(secretName);
    } else if (env === "live") {
      candidateNames.push("STRIPE_WEBHOOK_SECRET_LIVE", "STRIPE_WEBHOOK_SECRET");
    } else if (env === "sandbox") {
      candidateNames.push("STRIPE_WEBHOOK_SECRET_SANDBOX", "STRIPE_WEBHOOK_SECRET");
    } else {
      candidateNames.push(
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_WEBHOOK_SECRET_SANDBOX",
        "STRIPE_WEBHOOK_SECRET_LIVE",
      );
    }

    // Parse Stripe-Signature header.
    let timestamp: string | undefined;
    const v1Signatures: string[] = [];
    for (const part of signature.split(",")) {
      const [key, value] = part.split("=", 2);
      if (key?.trim() === "t") timestamp = value?.trim();
      if (key?.trim() === "v1") v1Signatures.push(value?.trim());
    }
    if (!timestamp || v1Signatures.length === 0) {
      return json({ ok: false, error: "Invalid signature header format (expected t=… and v1=…)" }, 200);
    }

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    const results: Array<{
      secret_name: string;
      configured: boolean;
      matched: boolean;
    }> = [];

    let anyMatched = false;
    for (const name of candidateNames) {
      const secret = Deno.env.get(name);
      if (!secret) {
        results.push({ secret_name: name, configured: false, matched: false });
        continue;
      }
      const expected = await computeExpected(secret, timestamp, payload);
      const matched = v1Signatures.includes(expected);
      results.push({ secret_name: name, configured: true, matched });
      if (matched) anyMatched = true;
    }

    return json({
      ok: anyMatched,
      matched: anyMatched,
      timestamp,
      age_seconds: Math.round(age),
      timestamp_within_tolerance: age <= 300,
      results,
    });
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 200);
  }
});