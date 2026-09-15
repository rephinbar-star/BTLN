// Group Read share-link management: create / revoke.
//
// Ownership is verified server-side. The public snapshot is built here and is
// the only thing a visitor can ever read — never result_json.

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

type RoleCard = {
  participant_id?: string;
  role?: string;
  headline?: string;
  why?: string;
  evidence?: string;
};

const pseudonym = (index: number) => `Participant ${String.fromCharCode(65 + (index % 26))}`;

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
  const groupReadId = String(body.group_read_id ?? "");
  const sessionId = String(body.session_id ?? "");
  if (!UUID_RE.test(groupReadId)) return json(400, { error: "Missing group read." });
  if (!["create", "revoke"].includes(action)) return json(400, { error: "Unknown action." });

  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    userId = data?.user?.id ?? null;
  }

  const { data: group } = await supabase
    .from("group_reads")
    .select("id, user_id, session_id, status, category, result_json, stats_json")
    .eq("id", groupReadId)
    .maybeSingle();
  if (!group) return json(404, { error: "That group read no longer exists." });

  const owns = group.user_id
    ? userId !== null && group.user_id === userId
    : UUID_RE.test(sessionId) && group.session_id === sessionId;
  if (!owns) return json(403, { error: "Not your group read." });

  if (action === "revoke") {
    await supabase
      .from("group_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("group_read_id", groupReadId)
      .is("revoked_at", null);
    return json(200, { revoked: true });
  }

  if (group.status !== "complete" || !group.result_json) {
    return json(400, { error: "This group read isn't finished yet." });
  }

  const includeNames = body.include_names === true;
  const includeQuotes = body.include_quotes === true;

  const result = group.result_json as Record<string, unknown>;
  const stats = (group.stats_json ?? {}) as {
    participants?: Array<{ id: string; share_pct: number; messages: number }>;
    message_count?: number;
  };
  const participants = (result.participants as Array<{ id: string; display_name: string }>) ?? [];

  const labelFor = (id: string | undefined) => {
    const idx = participants.findIndex((p) => p.id === id);
    if (idx < 0) return "Someone";
    return includeNames ? participants[idx].display_name : pseudonym(idx);
  };

  // When names are not released, real names must not survive anywhere in the
  // snapshot — including inside model-written prose.
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameSubs = includeNames
    ? []
    : participants
        .map((p, i) => ({ name: (p.display_name ?? "").trim(), alias: pseudonym(i) }))
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

  const roleCards = ((result.role_cards as RoleCard[]) ?? []).slice(0, 15).map((c) => ({
    label: labelFor(c.participant_id),
    role: typeof c.role === "string" ? scrub(c.role.slice(0, 40)) : "Group member",
    headline: typeof c.headline === "string" ? scrub(c.headline.slice(0, 160)) : "",
    why: typeof c.why === "string" ? scrub(c.why.slice(0, 280)) : "",
    ...(includeQuotes && typeof c.evidence === "string"
      ? { evidence: scrub(c.evidence.slice(0, 200)) }
      : {}),
    share_pct:
      stats.participants?.find((p) => p.id === c.participant_id)?.share_pct ?? null,
  }));

  const snapshot = {
    v: 1,
    category: group.category,
    title:
      typeof result.group_title === "string" ? scrub(result.group_title.slice(0, 80)) : "Group Read",
    subtitle:
      typeof result.group_summary === "string" ? scrub(result.group_summary.slice(0, 280)) : "",
    participant_count: participants.length,
    message_count: stats.message_count ?? null,
    include_names: includeNames,
    include_quotes: includeQuotes,
    role_cards: roleCards,
    strengths: Array.isArray(result.group_strengths)
      ? (result.group_strengths as unknown[]).slice(0, 3).map((s) => String(s).slice(0, 160))
      : [],
    created_at: new Date().toISOString(),
  };

  // Rotate: revoke any previous link so settings changes can't leak old copies.
  await supabase
    .from("group_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("group_read_id", groupReadId)
    .is("revoked_at", null);

  const rawToken = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(rawToken);

  const { error } = await supabase.from("group_share_links").insert({
    group_read_id: groupReadId,
    token_hash: tokenHash,
    snapshot_json: snapshot,
    include_names: includeNames,
    include_quotes: includeQuotes,
  });
  if (error) return json(500, { error: "Could not create the share link." });

  return json(200, { token: rawToken });
});
