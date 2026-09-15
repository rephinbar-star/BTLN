// Roast Us share-link management: create / revoke.
//
// Ownership is verified server-side. The public snapshot is built here and is
// the only thing a visitor can ever read — never the private roast row and
// never the source report.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const sha256Hex = async (s: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const pseudonym = (i: number) => `Person ${String.fromCharCode(65 + (i % 26))}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid request." });
  }

  const action = String(body.action ?? "");
  const roastId = String(body.roast_id ?? "");
  const sessionId = String(body.session_id ?? "");
  if (!UUID_RE.test(roastId)) return json(400, { error: "Missing roast." });
  if (!["create", "revoke"].includes(action)) return json(400, { error: "Unknown action." });

  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    userId = data?.user?.id ?? null;
  }

  const { data: roast } = await supabase
    .from("roasts")
    .select("id, user_id, session_id, status, safety_blocked, result_json")
    .eq("id", roastId)
    .maybeSingle();
  if (!roast) return json(404, { error: "That roast no longer exists." });

  const owns = roast.user_id
    ? userId !== null && roast.user_id === userId
    : UUID_RE.test(sessionId) && roast.session_id === sessionId;
  if (!owns) return json(403, { error: "Not your roast." });

  if (action === "revoke") {
    await supabase
      .from("roast_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("roast_id", roastId)
      .is("revoked_at", null);
    return json(200, { revoked: true });
  }

  if (roast.safety_blocked === true) {
    return json(400, { error: "This one can't be shared." });
  }
  if (roast.status !== "complete" || !roast.result_json) {
    return json(400, { error: "This roast isn't finished yet." });
  }

  const includeNames = body.include_names === true;
  const includeQuotes = body.include_quotes === true;

  const result = roast.result_json as Record<string, unknown>;
  const subjects = ((result.subjects as Array<{ id: string; display_name: string }>) ?? []).map(
    (s, i) => ({ ...s, alias: pseudonym(i) }),
  );

  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const subs = includeNames
    ? []
    : subjects
        .map((s) => ({ name: (s.display_name ?? "").trim(), alias: s.alias }))
        .filter((s) => s.name.length >= 2)
        .sort((a, b) => b.name.length - a.name.length);

  const scrub = (text: string): string => {
    let out = text;
    for (const { name, alias } of subs) {
      out = out.replace(new RegExp(`\\b${escapeRe(name)}\\b('s)?`, "gi"), (_m, poss) =>
        poss ? `${alias}'s` : alias,
      );
    }
    return out;
  };

  const str = (v: unknown, max: number) =>
    typeof v === "string" ? scrub(v.replace(/\s+/g, " ").trim().slice(0, max)) : "";

  const labelFor = (id: unknown) => {
    const idx = subjects.findIndex((s) => s.id === String(id ?? ""));
    if (idx < 0) return includeNames ? "Someone" : "Someone";
    return includeNames ? subjects[idx].display_name : subjects[idx].alias;
  };

  const observations = ((result.observations as Record<string, unknown>[]) ?? [])
    .slice(0, 15)
    .map((o) => ({
      label: labelFor(o.subject_id),
      text: str(o.text, 240),
    }))
    .filter((o) => o.text.length > 0);

  const receiptRaw = result.receipt as Record<string, unknown> | null;
  const receipt =
    includeQuotes && receiptRaw && typeof receiptRaw.quote === "string"
      ? { quote: str(receiptRaw.quote, 200), note: str(receiptRaw.note, 200) }
      : null;

  const snapshot = {
    v: 1,
    context: String(result.source_type ?? "analysis"),
    category: String(result.source_category ?? ""),
    headline: str(result.headline, 140),
    observations,
    receipt,
    closing: str(result.closing, 240),
    seriously: ((result.seriously as unknown[]) ?? []).slice(0, 4).map((s) => str(s, 240)).filter(Boolean),
    include_names: includeNames,
    include_quotes: includeQuotes,
    created_at: new Date().toISOString(),
  };

  // One live link at a time: revoke any previous one.
  await supabase
    .from("roast_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("roast_id", roastId)
    .is("revoked_at", null);

  const raw = b64url(crypto.getRandomValues(new Uint8Array(24)));
  const tokenHash = await sha256Hex(raw);

  const { error } = await supabase.from("roast_share_links").insert({
    roast_id: roastId,
    token_hash: tokenHash,
    snapshot_json: snapshot,
    include_names: includeNames,
    include_quotes: includeQuotes,
  });
  if (error) return json(500, { error: "Could not create that link." });

  return json(200, { token: raw, snapshot });
});
