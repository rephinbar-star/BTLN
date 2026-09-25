import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Download, Loader2, Plus, Trash2, EyeOff, Eye, UserCheck, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { Header } from "@/components/chemistry/Header";
import { BottomNav } from "@/components/nav/BottomNav";
import { Button } from "@/components/ui/button";
import { SeeExample } from "@/components/examples/ExampleExperience";
import { Relationship360Live } from "@/components/relationship360/Relationship360Live";
import { RelationshipGrouping } from "@/components/relationship360/RelationshipGrouping";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  activate,
  autoInclude,
  confirmIdentity,
  createRelationship,
  deleteEverything,
  deleteRelationship,
  detectParticipants,
  exportEverything,
  getProfileState,
  linkSource,
  listOwnedReports,
  listRelationships,
  listSources,
  markNotMe,
  optOut,
  removeSource,
  setSourceExcluded,
} from "@/lib/journey/api";
import {
  CURRENT_CONSENT_VERSION,
  RELATIONSHIP_KINDS,
  RELATIONSHIP_SCOPES,
  SOURCE_KIND_LABELS,
  SOURCE_STATE_LABELS,
  sourceState,
  type JourneyProfileState,
  type JourneyRelationship,
  type JourneySource,
  type LinkableReport,
  type RelationshipKind,
  type RelationshipScope,
} from "@/lib/journey/types";

const Journey = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<JourneyProfileState | null>(null);
  const [relationships, setRelationships] = useState<JourneyRelationship[]>([]);
  const [reports, setReports] = useState<LinkableReport[]>([]);
  const [sources, setSources] = useState<Record<string, JourneySource[]>>({});
  const [busy, setBusy] = useState(false);

  const [consentAuto, setConsentAuto] = useState(true);

  const [newKind, setNewKind] = useState<RelationshipKind>("romantic");
  const [newScope, setNewScope] = useState<RelationshipScope>("pair");
  const [newLabel, setNewLabel] = useState("");

  const [linkTarget, setLinkTarget] = useState<string | null>(null);
  const [linkReport, setLinkReport] = useState("");
  const [identityTarget, setIdentityTarget] = useState<string | null>(null);
  const [detected, setDetected] = useState<string[]>([]);
  const [identityChoice, setIdentityChoice] = useState("");

  const optedIn = Boolean(profile?.optedInAt);
  const needsReconsent =
    optedIn && (profile?.consentVersion ?? 0) < CURRENT_CONSENT_VERSION;

  const fail = useCallback(
    (e: unknown, fallback: string) => {
      toast({
        title: fallback,
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    },
    [toast],
  );

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const state = await getProfileState();
      if (state?.optedInAt && state.autoInclude) await autoInclude();
      setProfile(state);
      // Relationships and their controls stay readable after opting out or cancelling,
      // so correction, exclusion and deletion are never locked away.
      const rels = await listRelationships();
      setRelationships(rels);
      const entries = await Promise.all(
        rels.map(async (r) => [r.id, await listSources(r.id)] as const),
      );
      setSources(Object.fromEntries(entries));
      setReports(state?.optedInAt ? await listOwnedReports(user.id) : []);
    } catch (e) {
      fail(e, "Could not load your Relationship360");
    } finally {
      setLoading(false);
    }
  }, [user, fail]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const usedIds = useMemo(() => {
    const set = new Set<string>();
    Object.values(sources).forEach((list) => list.forEach((s) => set.add(s.source_id)));
    return set;
  }, [sources]);

  const pendingCount = useMemo(
    () =>
      Object.values(sources)
        .flat()
        .filter((s) => sourceState(s) === "identify").length,
    [sources],
  );

  const run = async (fn: () => Promise<void>, errorTitle: string) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      fail(e, errorTitle);
    } finally {
      setBusy(false);
    }
  };

  const turnOn = () =>
    run(async () => {
      await activate(consentAuto);
      if (consentAuto) {
        const added = await autoInclude();
        toast({
          title: added
            ? `${added} conversation${added === 1 ? "" : "s"} brought in`
            : "Relationship360 is on",
          description: added
            ? "Each one needs you to say which participant is you before it counts."
            : undefined,
        });
      }
    }, "Could not turn Relationship360 on");

  const openIdentity = async (source: JourneySource) => {
    setIdentityTarget(source.id);
    setIdentityChoice("");
    setDetected([]);
    try {
      const names = await detectParticipants(source.source_kind, source.source_id);
      setDetected(names);
    } catch {
      setDetected([]);
    }
  };

  const consentPoints = (
    <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-muted-foreground">
      <li>• Only reports saved to your own account can be included.</li>
      <li>• You always say which person in the chat is you. Nothing is matched by name.</li>
      <li>• If you are not in a conversation, you can say so and it stays out.</li>
      <li>• Only structured observations are kept, never the raw chat you uploaded.</li>
      <li>• You can correct, exclude or delete anything, at any time.</li>
    </ul>
  );

  const autoChoice = (
    <label className="mt-4 flex items-start gap-3 rounded-xl border border-border p-3 text-[14px] leading-relaxed text-foreground">
      <input
        type="checkbox"
        checked={consentAuto}
        onChange={(e) => setConsentAuto(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0"
      />
      <span>
        Bring in the reports I already own, and new ones as I finish them.
        <span className="block text-muted-foreground">
          Each conversation still waits for you to confirm which participant is you.
        </span>
      </span>
    </label>
  );

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Your Relationship360 | BetweenTheLines</title>
        <meta
          name="description"
          content="Your private Relationship360: the conversations you chose to include, and what they show over time."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Header />

      <main className="mx-auto max-w-2xl px-5 pb-24 pt-8">
        <h1 className="text-[28px] font-semibold leading-tight text-foreground sm:text-[34px]">
          Your Relationship360
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Understand who you are in your relationships—and get insights and coaching for self
          improvement. Relationship360 is private to your account. Nothing is added unless you add
          it yourself, and there is no share link for it.
        </p>
        <SeeExample kind="journey" />

        {loading ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {!optedIn && (
              <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-[18px] font-semibold text-foreground">
                  Turn Relationship360 on
                </h2>
                {consentPoints}
                {autoChoice}
                <Button
                  className="mt-5 h-12 w-full rounded-full"
                  disabled={busy || !user}
                  onClick={turnOn}
                >
                  Turn Relationship360 on
                </Button>
              </section>
            )}

            {needsReconsent && (
              <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-[18px] font-semibold text-foreground">
                  Confirm how Relationship360 works now
                </h2>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  You turned this on under the earlier one-report-at-a-time agreement. Nothing new
                  has been added. Confirm below if you want it to keep going, and choose whether
                  your own reports come in automatically.
                </p>
                {consentPoints}
                {autoChoice}
                <Button className="mt-5 h-12 w-full rounded-full" disabled={busy} onClick={turnOn}>
                  Confirm and continue
                </Button>
              </section>
            )}

            {optedIn && !needsReconsent && (
              <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-[18px] font-semibold text-foreground">Add a relationship</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {RELATIONSHIP_KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setNewKind(k.value)}
                      aria-pressed={newKind === k.value}
                      className={`min-h-[44px] rounded-full border px-4 text-[14px] transition-colors ${
                        newKind === k.value
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {RELATIONSHIP_SCOPES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setNewScope(s.value)}
                      aria-pressed={newScope === s.value}
                      className={`min-h-[44px] rounded-full border px-4 text-[14px] transition-colors ${
                        newScope === s.value
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  maxLength={80}
                  placeholder="A name only you see, e.g. “Sam” or “Sunday group”"
                  aria-label="Relationship name"
                  className="mt-3 w-full rounded-xl border border-border bg-background px-4 py-3 text-[15px] focus:border-foreground focus:outline-none"
                />
                <Button
                  className="mt-3 h-12 w-full rounded-full"
                  disabled={busy || !newLabel.trim()}
                  onClick={() =>
                    run(async () => {
                      await createRelationship(user!.id, newKind, newLabel, newScope);
                      setNewLabel("");
                    }, "Could not add the relationship")
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Add relationship
                </Button>
              </section>
            )}

            {optedIn && pendingCount > 0 && (
              <p className="mt-6 rounded-xl border border-border bg-muted/40 px-4 py-3 text-[14px] leading-relaxed text-foreground">
                {pendingCount} conversation{pendingCount === 1 ? "" : "s"} need you to say which
                participant is you. Until then they contribute nothing.

              </p>
            )}

            {optedIn && !needsReconsent && (
              <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-[18px] font-semibold text-foreground">Add a conversation</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  Start an eligible read with screenshots, a supported chat export, or pasted text. After that read completes, you can include its structured observations here and confirm which participant is you. Relationship360 never profiles a raw upload directly.
                </p>
                <Button asChild variant="outline" className="mt-4 h-12 w-full rounded-full">
                  <Link to="/deep?from=relationship360"><Upload className="h-4 w-4" /> Add through Deep Read</Link>
                </Button>
              </section>
            )}

            {!optedIn && relationships.length > 0 && (
              <p className="mt-8 text-[14px] leading-relaxed text-muted-foreground">
                Relationship360 is off, so nothing new is added. What you already included is below
                and you can still correct, exclude or remove it.
              </p>
            )}

            {relationships.length === 0
              ? optedIn && !needsReconsent && (
                  <p className="mt-6 text-[14px] text-muted-foreground">
                    No relationships yet. Add one above, then attach a report you already own.
                  </p>
                )
              : relationships.map((rel) => {
                  const linked = sources[rel.id] ?? [];
                  const available = reports.filter((r) => !usedIds.has(r.id));
                  const kindLabel =
                    RELATIONSHIP_KINDS.find((k) => k.value === rel.kind)?.label ?? "Not set yet";
                  const scopeLabel =
                    RELATIONSHIP_SCOPES.find((s) => s.value === rel.scope)?.label ?? "Two people";
                  return (
                    <section
                      key={rel.id}
                      className="mt-6 rounded-[20px] border border-btln-line bg-card p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-[17px] font-semibold text-foreground">
                            {rel.label}
                          </h3>
                          <p className="text-[13px] text-muted-foreground">
                            {scopeLabel} · {kindLabel} · {linked.length} linked
                            {rel.is_confirmed ? "" : " · not yet identified"}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Delete ${rel.label}`}
                          className="min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-destructive"
                          disabled={busy}
                          onClick={() => {
                            if (
                              !window.confirm(`Delete “${rel.label}” and everything linked to it?`)
                            )
                              return;
                            void run(
                              () => deleteRelationship(rel.id),
                              "Could not delete the relationship",
                            );
                          }}
                        >
                          <Trash2 className="mx-auto h-4 w-4" />
                        </button>
                      </div>

                      <RelationshipGrouping
                        relationship={rel}
                        sources={linked}
                        onChanged={() => void refresh()}
                      />

                      {linked.length > 0 && (
                        <ul className="mt-4 space-y-2">
                          {linked.map((s) => {
                            const state = sourceState(s);
                            return (
                              <li
                                key={s.id}
                                className="rounded-xl border border-border px-3 py-2"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-[14px] text-foreground">
                                      {SOURCE_KIND_LABELS[s.source_kind]}
                                      {s.subject_participant
                                        ? ` · you are ${s.subject_participant}`
                                        : ""}
                                    </p>
                                    <p className="text-[12px] text-muted-foreground">
                                      Added {new Date(s.uploaded_at).toLocaleDateString()} ·{" "}
                                      {SOURCE_STATE_LABELS[state]}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <button
                                      type="button"
                                      aria-label={
                                        state === "included"
                                          ? "Change who you are in this conversation"
                                          : "Identify yourself in this conversation"
                                      }
                                      disabled={busy}
                                      className="min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-foreground"
                                      onClick={() => void openIdentity(s)}
                                    >
                                      <UserCheck className="mx-auto h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={s.excluded_at ? "Include again" : "Exclude"}
                                      disabled={busy || s.identity_status === "absent"}
                                      className="min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
                                      onClick={() =>
                                        run(
                                          () => setSourceExcluded(s.id, !s.excluded_at),
                                          "Could not update this source",
                                        )
                                      }
                                    >
                                      {s.excluded_at ? (
                                        <Eye className="mx-auto h-4 w-4" />
                                      ) : (
                                        <EyeOff className="mx-auto h-4 w-4" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Remove from Relationship360"
                                      disabled={busy}
                                      className="min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-destructive"
                                      onClick={() =>
                                        run(() => removeSource(s.id), "Could not remove this source")
                                      }
                                    >
                                      <Trash2 className="mx-auto h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                {identityTarget === s.id && (
                                  <div className="mt-3 rounded-xl border border-dashed border-border p-3">
                                    <p className="text-[13px] font-medium text-foreground">
                                      Which person are you in this conversation?
                                    </p>
                                    {detected.length > 0 ? (
                                      <div className="mt-2 space-y-1">
                                        {detected.map((name, index) => {
                                          // Deep Read participants are confirmed by stable position, so two
                                          // people with the same display name stay distinct.
                                          const byPosition = s.source_kind === "deep_read" && detected.length === 2;
                                          const value = byPosition ? `id:p${index + 1}` : name;
                                          const duplicate = detected.filter((d) => d.trim().toLowerCase() === name.trim().toLowerCase()).length > 1;
                                          const shown = byPosition && duplicate ? `${name} (${index === 0 ? "first" : "second"} person)` : name;
                                          return (
                                          <label
                                            key={value}
                                            className="flex min-h-[44px] items-center gap-2 text-[14px] text-foreground"
                                          >
                                            <input
                                              type="radio"
                                              name={`who-${s.id}`}
                                              value={value}
                                              checked={identityChoice === value}
                                              onChange={() => setIdentityChoice(value)}
                                              className="h-4 w-4"
                                            />
                                            {shown}
                                          </label>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="mt-1 text-[13px] text-muted-foreground">
                                        We could not verify participant choices from this report, so
                                        it cannot contribute yet. You can exclude or remove it.
                                      </p>
                                    )}
                                    <div className="mt-3 flex flex-col gap-2">
                                      <Button
                                        className="h-12 rounded-full"
                                        disabled={busy || !identityChoice}
                                        onClick={() =>
                                          run(async () => {
                                            await confirmIdentity(s.id, identityChoice);
                                            setIdentityTarget(null);
                                          }, "Could not save who you are")
                                        }
                                      >
                                        Confirm this is me
                                      </Button>
                                      <Button
                                        variant="outline"
                                        className="h-12 rounded-full"
                                        disabled={busy}
                                        onClick={() =>
                                          run(async () => {
                                            await markNotMe(s.id);
                                            setIdentityTarget(null);
                                          }, "Could not update this conversation")
                                        }
                                      >
                                        I am not in this conversation
                                      </Button>
                                      <button
                                        type="button"
                                        className="min-h-[44px] text-[13px] text-muted-foreground underline"
                                        onClick={() => setIdentityTarget(null)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {optedIn && !needsReconsent ? (
                        linkTarget === rel.id ? (
                          <div className="mt-4 rounded-xl border border-dashed border-border p-3">
                            <label
                              className="text-[13px] text-muted-foreground"
                              htmlFor={`rep-${rel.id}`}
                            >
                              Which report?
                            </label>
                            <select
                              id={`rep-${rel.id}`}
                              value={linkReport}
                              onChange={(e) => setLinkReport(e.target.value)}
                              className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3 text-[15px]"
                            >
                              <option value="">Choose a saved report…</option>
                              {available.map((r) => (
                                <option key={r.id} value={`${r.kind}:${r.id}`}>
                                  {SOURCE_KIND_LABELS[r.kind]} · {r.label} ·{" "}
                                  {new Date(r.created_at).toLocaleDateString()}
                                </option>
                              ))}
                            </select>
                            <Button
                              className="mt-3 h-12 w-full rounded-full"
                              disabled={busy || !linkReport}
                              onClick={() =>
                                run(async () => {
                                  const [kind, id] = linkReport.split(":");
                                  await linkSource({
                                    userId: user!.id,
                                    relationshipId: rel.id,
                                    kind: kind as LinkableReport["kind"],
                                    sourceId: id,
                                  });
                                  setLinkTarget(null);
                                  setLinkReport("");
                                }, "Could not link this report")
                              }
                            >
                              Include this report
                            </Button>
                            <p className="mt-2 text-[12px] text-muted-foreground">
                              Only reports saved to your account can be included. After adding one,
                              choose a verified participant before it contributes.
                            </p>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            className="mt-4 h-12 w-full rounded-full"
                            disabled={busy}
                            onClick={() => {
                              setLinkTarget(rel.id);
                              setLinkReport("");
                            }}
                          >
                            Include a report
                          </Button>
                        )
                      ) : null}
                    </section>
                  );
                })}

            {optedIn && !needsReconsent && <Relationship360Live relationships={relationships} />}
          </>
        )}

        {/* Privacy controls stay available whether or not Relationship360 is on. */}
        {!loading && (
          <section className="mt-10 rounded-[20px] border border-btln-line bg-btln-mint p-5">
            <h2 className="text-[16px] font-semibold text-foreground">Privacy controls</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Relationship360 stores structured observations and the reports you linked — never the
              raw chat you uploaded, which follows the deletion rules already described in your
              privacy settings. Turning Relationship360 off stops anything new being added; deleting
              removes everything Relationship360 holds. Your original reports are not deleted by this.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="outline"
                className="h-12 rounded-full"
                disabled={busy}
                onClick={() => run(exportEverything, "Could not export your Relationship360 data")}
              >
                <Download className="h-4 w-4" /> Export my Relationship360 data
              </Button>
              {optedIn && (
                <Button
                  variant="outline"
                  className="h-12 rounded-full"
                  disabled={busy}
                  onClick={() => run(() => optOut(user!.id), "Could not turn Relationship360 off")}
                >
                  Turn Relationship360 off
                </Button>
              )}
              <Button
                variant="destructive"
                className="h-12 rounded-full"
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Delete everything in your Relationship360? This cannot be undone.",
                    )
                  )
                    return;
                  void run(() => deleteEverything(), "Could not delete your Relationship360 data");
                }}
              >
                Delete my Relationship360 data
              </Button>
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Journey;
