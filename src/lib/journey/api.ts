import { supabase } from "@/integrations/supabase/client";
import type {
  IdentityStatus,
  JourneyProfileState,
  JourneyRelationship,
  JourneySource,
  JourneySourceKind,
  LinkableReport,
  RelationshipKind,
  RelationshipScope,
} from "./types";

/**
 * Journey data access.
 *
 * Every table below is owner-only at the database level (RLS), and linking a
 * report into a Journey is validated server-side against the report's owner —
 * the browser cannot link a conversation it does not own. Nothing here ever
 * reads or stores raw message text.
 */

export async function getProfileState(): Promise<JourneyProfileState | null> {
  const { data } = await supabase
    .from("journey_profiles")
    .select("opted_in_at, auto_include_enabled, activation_consent_at, consent_version")
    .maybeSingle();
  if (!data) return null;
  return {
    optedInAt: data.opted_in_at,
    autoInclude: Boolean(data.auto_include_enabled),
    activationConsentAt: data.activation_consent_at,
    consentVersion: data.consent_version ?? 0,
  };
}

/** Activation consent. Supersedes the old bare opt-in; the choice is explicit each time. */
export async function activate(autoInclude: boolean): Promise<void> {
  const { error } = await supabase.rpc("journey_activate", { p_auto_include: autoInclude });
  if (error) throw error;
}

/** Brings in eligible reports the person owns. Each one still needs identity confirmation. */
export async function autoInclude(): Promise<number> {
  const { data, error } = await supabase.rpc("journey_auto_include");
  if (error) throw error;
  return data ?? 0;
}

/** Participant names detected in a report the caller owns. Never returns message text. */
export async function detectParticipants(
  kind: JourneySourceKind,
  sourceId: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("journey_source_participants", {
    p_source_kind: kind,
    p_source_id: sourceId,
  });
  if (error) throw error;
  return (data ?? []).filter((v): v is string => Boolean(v && v.trim()));
}

export async function confirmIdentity(sourceId: string, participant: string): Promise<void> {
  const { error } = await supabase.rpc("journey_confirm_identity", {
    p_source_id: sourceId,
    p_participant: participant.trim(),
  });
  if (error) throw error;
}

export async function markNotMe(sourceId: string): Promise<void> {
  const { error } = await supabase.rpc("journey_mark_absent", { p_source_id: sourceId });
  if (error) throw error;
}

export async function optOut(userId: string): Promise<void> {
  const { error } = await supabase
    .from("journey_profiles")
    .update({ opted_in_at: null, auto_include_enabled: false })
    .eq("user_id", userId);
  if (error) throw error;
}


export async function listRelationships(): Promise<JourneyRelationship[]> {
  const { data, error } = await supabase
    .from("journey_relationships")
    .select("id, kind, label, data_version, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as JourneyRelationship[];
}

export async function createRelationship(
  userId: string,
  kind: RelationshipKind,
  label: string,
): Promise<JourneyRelationship> {
  const { data, error } = await supabase
    .from("journey_relationships")
    .insert({ user_id: userId, kind, label: label.trim() })
    .select("id, kind, label, data_version, created_at")
    .single();
  if (error) throw error;
  return data as JourneyRelationship;
}

export async function deleteRelationship(id: string): Promise<void> {
  const { error } = await supabase.from("journey_relationships").delete().eq("id", id);
  if (error) throw error;
}

export async function listSources(relationshipId: string): Promise<JourneySource[]> {
  const { data, error } = await supabase
    .from("journey_sources")
    .select(
      "id, relationship_id, source_kind, source_id, subject_participant, observed_period_start, observed_period_end, uploaded_at, consent_at, excluded_at",
    )
    .eq("relationship_id", relationshipId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as JourneySource[];
}

export async function linkSource(params: {
  userId: string;
  relationshipId: string;
  kind: JourneySourceKind;
  sourceId: string;
  subjectParticipant: string;
}): Promise<void> {
  const { data, error } = await supabase.from("journey_sources").insert({
    user_id: params.userId,
    relationship_id: params.relationshipId,
    source_kind: params.kind,
    source_id: params.sourceId,
    subject_participant: params.subjectParticipant.trim() || null,
  }).select("id").single();
  if (error) throw error;
  if (params.kind === "group_roast" && data?.id) {
    const { error: adapterError } = await supabase.functions.invoke("group-roast-data", {
      body: { action: "adapt_journey", group_roast_id: params.sourceId, journey_source_id: data.id },
    });
    if (adapterError) {
      await supabase.from("journey_sources").delete().eq("id", data.id);
      throw adapterError;
    }
  }
}

export async function setSourceExcluded(id: string, excluded: boolean): Promise<void> {
  const { error } = await supabase
    .from("journey_sources")
    .update({ excluded_at: excluded ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function removeSource(id: string): Promise<void> {
  const { error } = await supabase.from("journey_sources").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteEverything(): Promise<void> {
  const { error } = await supabase.rpc("journey_delete_all");
  if (error) throw error;
}

/**
 * Reports the signed-in person owns. Only claimed (signed-in) reports appear —
 * anonymous browser-session reports must be saved to the account first, which
 * is the consent step that stops silent cross-matching of private chats.
 */
export async function listOwnedReports(userId: string): Promise<LinkableReport[]> {
  const [deep, groupRoasts, group, quick, roast] = await Promise.all([
    supabase
      .from("analyses")
      .select("id, created_at, context_data, status")
      .eq("user_id", userId)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.functions.invoke("group-roast-data", { body: { action: "list" } }),
    supabase
      .from("group_reads")
      .select("id, created_at, participant_count, status")
      .eq("user_id", userId)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("decodes")
      .select("id, created_at, status")
      .eq("user_id", userId)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("roasts")
      .select("id, created_at, status, source_type")
      .eq("user_id", userId)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const out: LinkableReport[] = [];
  for (const row of deep.data ?? []) {
    const ctx = (row.context_data ?? {}) as { name1?: string; name2?: string };
    const names = [ctx.name1, ctx.name2].filter(Boolean).join(" & ");
    out.push({
      kind: "deep_read",
      id: row.id,
      label: names || "Deep Read",
      created_at: row.created_at,
    });
  }
  for (const row of group.data ?? []) {
    out.push({
      kind: "group_read",
      id: row.id,
      label: `${row.participant_count} people`,
      created_at: row.created_at,
    });
  }
  for (const row of quick.data ?? []) {
    out.push({ kind: "quick_take", id: row.id, label: "Quick Take", created_at: row.created_at });
  }
  for (const row of roast.data ?? []) {
    // Only group roasts are a Journey source kind; pair roasts stay out.
    if (row.source_type !== "group_read") continue;
    out.push({ kind: "group_roast", id: row.id, label: "Group Roast", created_at: row.created_at });
  }
  for (const row of groupRoasts.data?.roasts ?? []) {
    out.push({ kind: "group_roast", id: row.id, label: `Group Roast · ${row.participant_count} people`, created_at: row.created_at });
  }
  return out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
