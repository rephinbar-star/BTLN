import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Dash = {
  aggregates: any[];
  versions: any[];
  jobs: any[];
  reviews: any[];
  selection: any[];
  audit: any[];
  cases: { id: string; purpose: string; held_out: boolean }[];
  min_cohort: number;
};

const call = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("prompt-improvement", { body });
  if (error) {
    let message = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.json) message = (await ctx.json())?.error ?? message;
    } catch { /* keep message */ }
    throw new Error(message);
  }
  return data as any;
};

const short = (h?: string | null) => (h ? `${h.slice(0, 10)}…` : "—");

/**
 * Operator-only improvement workflow. Authority is on the server: every action
 * re-checks the operator role and the exact evaluated hashes. Production
 * promotion is disabled; only the sandbox can be switched and rolled back.
 */
const AdminImprovement = () => {
  const { isAdmin, checking } = useAdminRole();
  const [dash, setDash] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [rationale, setRationale] = useState("");
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [sandboxOut, setSandboxOut] = useState<any>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setDash(await call({ action: "dashboard" })); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);
  useEffect(() => {
    if (!dash?.jobs.some((j) => j.status === "running")) return;
    const t = setTimeout(load, 5000);
    return () => clearTimeout(t);
  }, [dash, load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const versionById = useMemo(() => new Map((dash?.versions ?? []).map((v) => [v.id, v])), [dash]);
  const sandbox = dash?.selection.find((s) => s.environment === "sandbox");

  const openResults = async (jobId: string) => {
    setOpenJob(jobId);
    try { setResults((await call({ action: "results", job_id: jobId })).results); } catch (e) { setError((e as Error).message); }
  };

  if (checking) return <Shell>Checking access…</Shell>;
  if (!isAdmin) return <Shell><p>This page is for operators only.</p><Link className="underline underline-offset-4" to="/">Back to home</Link></Shell>;

  const job = dash?.jobs.find((j) => j.id === openJob);
  const byCase = new Map<string, { baseline?: any; candidate?: any }>();
  results.forEach((r) => byCase.set(r.case_id, { ...(byCase.get(r.case_id) ?? {}), [r.variant]: r }));

  return (
    <Shell>
      <Helmet><title>Improvement workflow | BetweenTheLines</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <h1 className="text-[26px] font-medium tracking-tight">Improvement workflow</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        Feedback is a subjective signal, not ground truth. Candidates are evaluated with real model calls on synthetic cases,
        screened against the frozen Deep Read principles, then reviewed by an operator. Nothing retrains the model.
        Production promotion is disabled; only the sandbox can be switched.
      </p>
      {error && <p role="alert" className="mt-4 text-[14px] text-destructive">{error}</p>}

      <Section title="Feedback signals (last 90 days)">
        {!dash ? <Muted>Loading…</Muted> : dash.aggregates.length === 0 ? <Muted>No ratings yet. Demo ratings are never stored.</Muted> : (
          <ul className="space-y-2 text-[14px]">
            {dash.aggregates.map((a, i) => (
              <li key={i} className="rounded-lg border border-btln-line p-3">
                <span className="font-medium">{a.source_kind} · {a.target_kind}</span>{" "}
                {a.suppressed ? <Muted>fewer than {dash.min_cohort} ratings — hidden to protect privacy</Muted> : (
                  <>— {a.up} Helpful / {a.down} Don't Like It (n={a.sample_size}){Object.keys(a.reasons).length > 0 && <>; reasons: {Object.entries(a.reasons).map(([k, v]) => `${k} ${v}`).join(", ")}</>}</>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Draft a candidate">
        <div className="space-y-3">
          <Input aria-label="Candidate label" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="min-h-11" />
          <Textarea aria-label="Candidate prompt" placeholder="Prompt text (the frozen principles are always added and cannot be changed)" value={text} onChange={(e) => setText(e.target.value)} rows={6} />
          <Input aria-label="Rationale" placeholder="Which aggregate issue this addresses" value={rationale} onChange={(e) => setRationale(e.target.value)} className="min-h-11" />
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11 rounded-full" disabled={busy} onClick={() => run(async () => {
              const top = dash?.aggregates.find((a) => !a.suppressed);
              const r = await call({ action: "suggest_candidate", target: top ? `${top.source_kind}:${top.target_kind}` : "deep_read", reasons: top ? Object.keys(top.reasons) : [], sample_size: top?.sample_size ?? 0 });
              setText(r.suggestion);
            })}>Suggest wording</Button>
            <Button className="min-h-11 rounded-full" variant="outline" disabled={busy || !label || text.length < 20} onClick={() => run(async () => {
              await call({ action: "create_candidate", label, prompt_text: text, rationale });
              setLabel(""); setText(""); setRationale("");
            })}>Save as new version</Button>
          </div>
          <Muted>Saved versions can't be edited. Changing the text creates a new version that needs its own evaluation and review.</Muted>
        </div>
      </Section>

      <Section title="Versions">
        <p className="mb-3 text-[14px]">Sandbox runtime: <span className="font-medium">{sandbox ? versionById.get(sandbox.version_id)?.label ?? sandbox.version_id : "Baseline (no selection)"}</span></p>
        <ul className="space-y-3">
          {(dash?.versions ?? []).map((v) => {
            const vJobs = dash!.jobs.filter((j) => j.candidate_id === v.id);
            return (
              <li key={v.id} className="rounded-lg border border-btln-line p-3 text-[14px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{v.label}{v.is_test_record && <span className="ml-2 text-[12px] text-muted-foreground">(test record)</span>}</span>
                  <span className="text-[12px] text-muted-foreground">{v.kind} · hash {short(v.content_hash)}</span>
                </div>
                {v.kind === "candidate" && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" className="min-h-11 rounded-full" disabled={busy} onClick={() => run(async () => { await call({ action: "evaluate", candidate_id: v.id }); })}>Evaluate</Button>
                    {vJobs.map((j) => (
                      <Button key={j.id} size="sm" variant="outline" className="min-h-11 rounded-full" onClick={() => openResults(j.id)}>
                        {j.status === "running" ? `Running (${j.calls_made} calls)` : `Results: ${j.summary?.candidate_screen_passes ?? "?"}/${j.cases_total} pass`}
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {job && (
        <Section title={`Comparison — ${versionById.get(job.candidate_id)?.label ?? ""}`}>
          <p className="text-[13px] text-muted-foreground">
            Bound to hash {short(job.binding_hash)} · {job.calls_made} calls, {job.calls_failed} failed · {job.prompt_tokens + job.completion_tokens} tokens · ${Number(job.cost_usd).toFixed(4)}
            {job.summary && <> · baseline {job.summary.baseline_screen_passes}/{job.summary.cases} vs candidate {job.summary.candidate_screen_passes}/{job.summary.cases} · wins {job.summary.wins?.length ?? 0}, regressions {job.summary.regressions?.length ?? 0}{job.summary.incomplete && " · INCOMPLETE (approval blocked)"}</>}
          </p>
          <div className="mt-3 space-y-4">
            {[...byCase.entries()].map(([caseId, pair]) => {
              const meta = dash?.cases.find((c) => c.id === caseId);
              return (
                <div key={caseId} className="rounded-lg border border-btln-line p-3">
                  <p className="text-[14px] font-medium">{caseId}{meta?.held_out && " (held out)"} <Muted>— {meta?.purpose}</Muted></p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    {(["baseline", "candidate"] as const).map((variant) => {
                      const r = pair[variant];
                      return (
                        <div key={variant} className="rounded-md bg-muted/40 p-3 text-[13px]">
                          <p className="font-medium">{variant} — {r?.screen_passed ? "passes screen" : "fails screen"}{r?.disagreement && " · judge disagrees, needs human review"}</p>
                          <p className="mt-1">{r?.output?.insight ?? r?.error_message ?? "No output"}</p>
                          {r?.output?.uncertainty && <p className="mt-1 text-muted-foreground">Uncertainty: {r.output.uncertainty}</p>}
                          <ul className="mt-2 space-y-0.5">
                            {(r?.checks ?? []).filter((c: any) => c.passed !== true).map((c: any) => <li key={c.id} className="text-destructive">✗ {c.id}: {c.detail}</li>)}
                          </ul>
                          {r?.judge && <p className="mt-2 text-muted-foreground">Judge (screening aid): {JSON.stringify(r.judge.scores)}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 space-y-2">
            <Textarea aria-label="Review rationale" placeholder="Your rationale (required). You are signed in as the reviewer." value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} />
            <div className="flex flex-wrap gap-2">
              <Button className="min-h-11 rounded-full" disabled={busy || job.status !== "complete"} onClick={() => run(async () => { await call({ action: "review", job_id: job.id, decision: "approved", rationale: reviewNote, expected_binding_hash: job.binding_hash }); setReviewNote(""); })}>Approve</Button>
              <Button className="min-h-11 rounded-full" variant="outline" disabled={busy || job.status !== "complete"} onClick={() => run(async () => { await call({ action: "review", job_id: job.id, decision: "rejected", rationale: reviewNote, expected_binding_hash: job.binding_hash }); setReviewNote(""); })}>Reject</Button>
            </div>
            {dash?.reviews.filter((r) => r.job_id === job.id).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                <span>{r.decision} {new Date(r.created_at).toLocaleString()}{r.is_test_record && " (test record)"} — {r.rationale}</span>
                {r.decision === "approved" && <Button size="sm" className="min-h-11 rounded-full" disabled={busy} onClick={() => run(async () => { await call({ action: "activate", environment: "sandbox", review_id: r.id, version_id: r.candidate_id }); })}>Activate in sandbox</Button>}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Sandbox runtime">
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11 rounded-full" disabled={busy} onClick={() => run(async () => { setSandboxOut(await call({ action: "sandbox_generate", case_id: "plan-mismatch" })); })}>Run sandbox generation</Button>
          <Button className="min-h-11 rounded-full" variant="outline" disabled={busy || !sandbox} onClick={() => run(async () => { await call({ action: "rollback", environment: "sandbox" }); })}>Roll back sandbox</Button>
        </div>
        {sandboxOut && (
          <div className="mt-3 rounded-md bg-muted/40 p-3 text-[13px]">
            <p className="font-medium">Ran {sandboxOut.metadata.label} (hash {short(sandboxOut.metadata.content_hash)}){sandboxOut.metadata.fallback && ` — fallback: ${sandboxOut.metadata.reason}`}</p>
            <p className="mt-1">{sandboxOut.output?.insight}</p>
          </div>
        )}
      </Section>

      <Section title="Audit (content-free)">
        <ul className="space-y-1 text-[13px] text-muted-foreground">
          {(dash?.audit ?? []).map((a) => <li key={a.id}>{new Date(a.created_at).toLocaleString()} · {a.action} · {a.entity}</li>)}
        </ul>
      </Section>
    </Shell>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-10"><h2 className="mb-3 text-[18px] font-medium">{title}</h2>{children}</section>
);
const Muted = ({ children }: { children: React.ReactNode }) => <span className="text-[13px] text-muted-foreground">{children}</span>;
const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background text-foreground"><main className="mx-auto max-w-4xl px-5 py-12 sm:px-8">{children}</main></div>
);

export default AdminImprovement;
