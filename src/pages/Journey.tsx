import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Loader2, Plus, Trash2, EyeOff, Eye } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  createRelationship,
  deleteEverything,
  deleteRelationship,
  getOptInState,
  linkSource,
  listOwnedReports,
  listRelationships,
  listSources,
  optIn,
  optOut,
  removeSource,
  setSourceExcluded,
} from "@/lib/journey/api";
import {
  RELATIONSHIP_KINDS,
  SOURCE_KIND_LABELS,
  type JourneyRelationship,
  type JourneySource,
  type LinkableReport,
  type RelationshipKind,
} from "@/lib/journey/types";

const Journey = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [optedInAt, setOptedInAt] = useState<string | null>(null);
  const [relationships, setRelationships] = useState<JourneyRelationship[]>([]);
  const [reports, setReports] = useState<LinkableReport[]>([]);
  const [sources, setSources] = useState<Record<string, JourneySource[]>>({});
  const [busy, setBusy] = useState(false);

  const [newKind, setNewKind] = useState<RelationshipKind>("romantic");
  const [newLabel, setNewLabel] = useState("");

  const [linkTarget, setLinkTarget] = useState<string | null>(null);
  const [linkReport, setLinkReport] = useState("");
  const [linkMe, setLinkMe] = useState("");

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
      const state = await getOptInState();
      setOptedInAt(state?.optedInAt ?? null);
      if (state?.optedInAt) {
        const [rels, owned] = await Promise.all([listRelationships(), listOwnedReports(user.id)]);
        setRelationships(rels);
        setReports(owned);
        const entries = await Promise.all(
          rels.map(async (r) => [r.id, await listSources(r.id)] as const),
        );
        setSources(Object.fromEntries(entries));
      } else {
        setRelationships([]);
        setSources({});
      }
    } catch (e) {
      fail(e, "Could not load your Journey");
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

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Your Journey | BetweenTheLines</title>
        <meta
          name="description"
          content="Your private Relationship Journey: the conversations you chose to include, and what they show over time."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Header />

      <main className="mx-auto max-w-2xl px-5 pb-24 pt-8">
        <h1 className="text-[28px] font-semibold leading-tight text-foreground sm:text-[34px]">
          Your Journey
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Understand who you are in your relationships — and how you're changing. Journey is
          private to your account. Nothing is added unless you add it yourself, and there is no
          share link for it.
        </p>

        {loading ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !optedInAt ? (
          <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-[18px] font-semibold text-foreground">Turn Journey on</h2>
            <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-muted-foreground">
              <li>• You choose which of your own reports are included — one at a time.</li>
              <li>• You tell us which person in the chat is you. Nothing is matched by name.</li>
              <li>• Only structured observations are kept, never the raw chat you uploaded.</li>
              <li>• You can correct, exclude or delete anything, at any time.</li>
            </ul>
            <Button
              className="mt-5 h-12 w-full rounded-full"
              disabled={busy || !user}
              onClick={() => run(() => optIn(user!.id), "Could not turn Journey on")}
            >
              Turn Journey on
            </Button>
          </section>
        ) : (
          <>
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
                    await createRelationship(user!.id, newKind, newLabel);
                    setNewLabel("");
                  }, "Could not add the relationship")
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add relationship
              </Button>
            </section>

            {relationships.length === 0 ? (
              <p className="mt-6 text-[14px] text-muted-foreground">
                No relationships yet. Add one above, then attach a report you already own.
              </p>
            ) : (
              relationships.map((rel) => {
                const linked = sources[rel.id] ?? [];
                const available = reports.filter((r) => !usedIds.has(r.id));
                return (
                  <section
                    key={rel.id}
                    className="mt-6 rounded-[20px] border border-btln-line bg-card p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[17px] font-semibold text-foreground">{rel.label}</h3>
                        <p className="text-[13px] text-muted-foreground">
                          {RELATIONSHIP_KINDS.find((k) => k.value === rel.kind)?.label} ·{" "}
                          {linked.length} linked
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete ${rel.label}`}
                        className="min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`Delete “${rel.label}” and everything linked to it?`))
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

                    {linked.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {linked.map((s) => (
                          <li
                            key={s.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[14px] text-foreground">
                                {SOURCE_KIND_LABELS[s.source_kind]}
                                {s.subject_participant ? ` · you are ${s.subject_participant}` : ""}
                              </p>
                              <p className="text-[12px] text-muted-foreground">
                                Added {new Date(s.uploaded_at).toLocaleDateString()}
                                {s.excluded_at ? " · excluded" : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                aria-label={s.excluded_at ? "Include again" : "Exclude"}
                                disabled={busy}
                                className="min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-foreground"
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
                                aria-label="Remove from Journey"
                                disabled={busy}
                                className="min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  run(() => removeSource(s.id), "Could not remove this source")
                                }
                              >
                                <Trash2 className="mx-auto h-4 w-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {linkTarget === rel.id ? (
                      <div className="mt-4 rounded-xl border border-dashed border-border p-3">
                        <label className="text-[13px] text-muted-foreground" htmlFor={`rep-${rel.id}`}>
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
                        <label className="mt-3 block text-[13px] text-muted-foreground" htmlFor={`me-${rel.id}`}>
                          Which participant is you? (exactly as they appear in the chat)
                        </label>
                        <input
                          id={`me-${rel.id}`}
                          value={linkMe}
                          onChange={(e) => setLinkMe(e.target.value)}
                          className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3 text-[15px]"
                        />
                        <Button
                          className="mt-3 h-12 w-full rounded-full"
                          disabled={busy || !linkReport || !linkMe.trim()}
                          onClick={() =>
                            run(async () => {
                              const [kind, id] = linkReport.split(":");
                              await linkSource({
                                userId: user!.id,
                                relationshipId: rel.id,
                                kind: kind as LinkableReport["kind"],
                                sourceId: id,
                                subjectParticipant: linkMe,
                              });
                              setLinkTarget(null);
                              setLinkReport("");
                              setLinkMe("");
                            }, "Could not link this report")
                          }
                        >
                          Include this report
                        </Button>
                        <p className="mt-2 text-[12px] text-muted-foreground">
                          Only reports saved to your account can be included, and only your own.
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
                          setLinkMe("");
                        }}
                      >
                        Include a report
                      </Button>
                    )}
                  </section>
                );
              })
            )}

            <section className="mt-10 rounded-[20px] border border-btln-line bg-btln-mint p-5">
              <h2 className="text-[16px] font-semibold text-foreground">Privacy controls</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Journey stores structured observations and the reports you linked — never the raw
                chat you uploaded, which follows the deletion rules already described in your
                privacy settings. Turning Journey off stops anything new being added; deleting
                removes everything Journey holds.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="h-12 rounded-full"
                  disabled={busy}
                  onClick={() => run(() => optOut(user!.id), "Could not turn Journey off")}
                >
                  Turn Journey off
                </Button>
                <Button
                  variant="destructive"
                  className="h-12 rounded-full"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm("Delete everything in your Journey? This cannot be undone."))
                      return;
                    void run(() => deleteEverything(), "Could not delete your Journey");
                  }}
                >
                  Delete my Journey data
                </Button>
              </div>
            </section>

            <p className="mt-8 text-[13px] leading-relaxed text-muted-foreground">
              Timelines and patterns across these conversations are still being built. Until they
              are ready, this page shows only what you have chosen to include — no trends are
              claimed from it.
            </p>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Journey;
