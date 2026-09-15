// Deep Read (two-person) share-link management: create / revoke.
//
// Ownership is verified server-side. The public snapshot is built here and is
// the only thing a visitor can ever read — never result_json, never raw chat.

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

const pseudonym = (index: number) => `Person ${String.fromCharCode(65 + (index % 26))}`;

const STYLE_BLURB: Record<string, string> = {
  secure: "steady and direct — says what they mean and stays reachable",
  anxious: "reaches out often and feels the gaps between replies",
  avoidant: "keeps some distance when things get intense",
  disorganized: "swings between reaching out and pulling back",
  "mixed/unclear": "hard to pin down from this stretch of chat",
};

const flagText = (f: unknown): string => {
  if (typeof f === "string") return f;
  if (f && typeof f === "object") {
    const o = f as Record<string, unknown>;
    return String(o.title ?? o.description ?? "");
  }
  return "";
};

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
  const analysisId = String(body.analysis_id ?? "");
  const sessionId = String(body.session_id ?? "");
  if (!UUID_RE.test(analysisId)) return json(400, { error: "Missing report." });
  if (!["create", "revoke"].includes(action)) return json(400, { error: "Unknown action." });

  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    userId = data?.user?.id ?? null;
  }

  const { data: analysis } = await supabase
    .from("analyses")
    .select("id, user_id, session_id, status, result_json, context_data, relationship_type")
    .eq("id", analysisId)
    .maybeSingle();
  if (!analysis) return json(404, { error: "That report no longer exists." });

  const owns = analysis.user_id
    ? userId !== null && analysis.user_id === userId
    : UUID_RE.test(sessionId) && analysis.session_id === sessionId;
  if (!owns) return json(403, { error: "Not your report." });

  if (action === "revoke") {
    await supabase
      .from("analysis_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("analysis_id", analysisId)
      .is("revoked_at", null);
    return json(200, { revoked: true });
  }

  if (analysis.status !== "complete" || !analysis.result_json) {
    return json(400, { error: "This report isn't finished yet." });
  }

  const result = analysis.result_json as Record<string, unknown>;
  const meta = (result.meta ?? {}) as { safety_concern?: boolean };
  if (meta.safety_concern === true) {
    return json(400, {
      error: "This report covers something serious, so it can't be turned into a shared link.",
    });
  }

  const includeNames = body.include_names === true;
  const includeQuotes = body.include_quotes === true;

  const ctx = (analysis.context_data ?? {}) as Record<string, unknown>;
  const names = [String(ctx.name1 ?? "").trim(), String(ctx.name2 ?? "").trim()];
  const labelFor = (i: number) => (includeNames && names[i] ? names[i] : pseudonym(i));

  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameSubs = includeNames
    ? []
    : names
        .map((name, i) => ({ name, alias: pseudonym(i) }))
        .filter((s) => s.name.length >= 2)
        .sort((a, b) => b.name.length - a.name.length);

  const scrub = (text: string): string => {
    let out = text;
    for (const { name, alias } of nameSubs) {
      out = out.replace(new RegExp(`\\b${escapeRe(name)}\\b('s)?`, "gi"), (_m, poss) =>
        poss ? `${alias}'s` : alias,
      );
    }
    return out;
  };

  const profiles = (result.attachment_profiles ?? {}) as Record<
    string,
    { primary_style?: string; confidence?: string; evidence_quotes?: string[] }
  >;
  const profileKeys = Object.keys(profiles);
  const headline = (result.headline ?? {}) as Record<string, unknown>;
  const diag = (result.communication_diagnostic ?? {}) as Record<string, unknown>;

  const roleCards = [0, 1].map((i) => {
    const key =
      profileKeys.find((k) => names[i] && k.toLowerCase() === names[i].toLowerCase()) ??
      profileKeys[i];
    const p = key ? profiles[key] : undefined;
    const style = String(p?.primary_style ?? "mixed/unclear");
    const quote = includeQuotes ? (p?.evidence_quotes ?? [])[0] : undefined;
    return {
      label: labelFor(i),
      role: style === "mixed/unclear" ? "Mixed signals" : `${style} leaning`,
      headline: scrub(STYLE_BLURB[style] ?? STYLE_BLURB["mixed/unclear"]).slice(0, 160),
      why: scrub(String(diag.key_observation ?? "").slice(0, 280)),
      ...(quote ? { evidence: scrub(String(quote).slice(0, 200)) } : {}),
      share_pct: null,
    };
  });

  const snapshot = {
    v: 1,
    kind: "analysis",
    category: String(analysis.relationship_type ?? "romantic"),
    title: scrub(String(headline.tier_label ?? "A two-person read").slice(0, 80)),
    subtitle: scrub(String(headline.vibe_summary ?? "").slice(0, 280)),
    participant_count: 2,
    message_count: null,
    include_names: includeNames,
    include_quotes: includeQuotes,
    role_cards: roleCards,
    strengths: Array.isArray(result.green_flags)
      ? (result.green_flags as unknown[])
          .slice(0, 3)
          .map((f) => scrub(flagText(f).slice(0, 160)))
          .filter(Boolean)
      : [],
    suggestions: Array.isArray(result.conversation_prompts)
      ? (result.conversation_prompts as unknown[])
          .slice(0, 2)
          .map((s) => scrub(String(s).slice(0, 200)))
      : [],
    created_at: new Date().toISOString(),
  };

  // Rotate: revoke any previous link so settings changes can't leak old copies.
  await supabase
    .from("analysis_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("analysis_id", analysisId)
    .is("revoked_at", null);

  const rawToken = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(rawToken);

  const { error } = await supabase.from("analysis_share_links").insert({
    analysis_id: analysisId,
    token_hash: tokenHash,
    snapshot_json: snapshot,
    include_names: includeNames,
    include_quotes: includeQuotes,
  });
  if (error) return json(500, { error: "Could not create the share link." });

  return json(200, { token: rawToken });
});
