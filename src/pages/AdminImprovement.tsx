import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Dash = {
  operator_is_test_account: boolean;
  min_cohort: number;
  aggregates: any[];
  versions: any[];
  jobs: any[];
  reviews: any[];
  selection: any[];
  audit: any[];
  notes: any[];
  packets: any[];
  budget: any;
  production_promotion: string;
  baseline_stale: Record<string, boolean>;
  modes: { key: string; label: string; parity: string; parity_note: string; cases: { id: string; kind: string; purpose: string }[] }[];
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
const usd = (n: unknown) => (typeof n === "number" ? `$${n.toFixed(4)}` : "unknown");

const STATE_LABEL: Record<string, string> = {
  eligible_for_review: "Eligible for review",
  needs_review: "Needs review (approval blocked)",
  approved: "Approved",
  rejected: "Rejected",
  running: "Running",
  incomplete: "Incomplete",
};

/**
 * Operator-only improvement workflow. Authority is on the server: every action
 * re-checks the operator role, the spend budget and the exact evaluated hashes.
 * Automated checks passing is never human approval. Production promotion is disabled.
 */
const AdminImprovement = () => {
  const { isAdmin, checking } = useAdminRole();
  const [params, setParams] = useSearchParams();
  const [dash, setDash] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<string>(params.get("mode") ?? "quick_take");
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [rationale, setRationale] = useState("");
  const openJob = params.get("job");
  const [results, setResults] = useState<any[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [caseNotes, setCaseNotes] = useState<Record<string, string>>({});
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

  useEffect(() => {
    if (!openJob || !isAdmin) { setResults([]); return; }
    call({ action: "results", job_id: openJob }).then((r) => setResults(r.results)).catch((e) => setError((e as Error).message));
  }, [openJob, isAdmin]);

  const versionById = useMemo(() => new Map((dash?.versions ?? []).map((v) => [v.id, v])), [dash]);
  const modeInfo = dash?.modes.find((m) => m.key === mode);

  if (checking) return <Shell>Checking access…</Shell>;
  if (!isAdmin) return <Shell><p>This page is for operators only.</p><Link className="underline underline-offset-4" to="/">Back to home</Link></Shell>;

  const job = dash?.jobs.find((j) => j.id === openJob);
  const jobMode = dash?.modes.find((m) => m.key === job?.mode);
  const byCase = new Map<string, { baseline?: any; candidate?: any }>();
  results.forEach((r) => byCase.set(r.case_id, { ...(byCase.get(r.case_id) ?? {}), [r.variant]: r }));
  const sandbox = dash?.selection.find((s) => s.environment === "sandbox" && s.mode === mode);
  const b = dash?.budget;

  const openJobLink = (id: string, m: string) => setParams({ mode: m, job: id });

  return (
    <Shell>
      <Helmet><title>Improvement workflow | BetweenTheLines</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <h1 className="text-[26px] font-medium tracking-tight">Improvement workflow</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        Feedback is a subjective signal, not ground truth. Candidates are evaluated with real model calls on synthetic cases and screened against
        frozen principles. Automated checks and the judge are screening aids only; passing them is not human approval. Nothing retrains the model.
        Production promotion is disabled; only the sandbox can be switched.
      </p>
      {dash?.operator_is_test_account && <p className="mt-2 text-[13px] text-muted-foreground">You are signed in with a synthetic test account: any decision you record is marked as a test record, never owner sign-off.</p>}
      {error && <p role="alert" className="mt-4 text-[14px] text-destructive">{error}</p>}

      <Section title="Spending limit (internal test limit, not a customer allowance)">
        {!b ? <Muted>Loading…</Muted> : (
          <div className="grid grid-cols-2 gap-2 text-[14px] sm:grid-cols-4">
            <Stat label="Spent" value={usd(b.spent_usd)} />
            <Stat label="Unknown (counted in full)" value={usd(b.unknown_usd)} />
            <Stat label="Reserved in flight" value={usd(b.reserved_usd)} />
            <Stat label={`Remaining of ${usd(b.global_cap_usd)} / ${b.window_hours}h`} value={usd(b.remaining_usd)} />
            <p className="col-span-2 text-[12px] text-muted-foreground sm:col-span-4">Per evaluation cap {usd(b.per_job_cap_usd)} · per call cap {usd(b.per_call_cap_usd)}. Every call reserves its maximum cost before it runs.</p>
          </div>
        )}
      </Section>

      <Section title="Review packets">
        {(dash?.packets ?? []).length === 0 ? <Muted>No packets yet.</Muted> : dash!.packets.map((p) => (
          <div key={p.id} className="mb-3 rounded-lg border border-btln-line p-3 text-[14px]">
            <p className="font-medium">{p.title}</p>
            <p className="text-[12px] text-muted-foreground">Packet {p.id}</p>
            <ul className="mt-2 space-y-2">
              {(p.items ?? []).map((it: any) => {
                const j = dash!.jobs.find((x) => x.id === it.job_id);
                return (
                  <li key={it.job_id}>
                    <button type="button" className="min-h-11 text-left underline underline-offset-4" onClick={() => openJobLink(it.job_id, it.mode)}>
                      {dash!.modes.find((m) => m.key === it.mode)?.label ?? it.mode} — {STATE_LABEL[j?.review_state?.state] ?? j?.review_state?.state ?? "?"}
                    </button>
                    <p className="text-[13px] text-muted-foreground">{it.highlight}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="Mode">
        <div role="tablist" aria-label="Mode" className="flex flex-wrap gap-2">
          {(dash?.modes ?? []).map((m) => (
            <Button key={m.key} role="tab" aria-selected={mode === m.key} size="sm" variant={mode === m.key ? "default" : "outline"} className="min-h-11 rounded-full" onClick={() => { setMode(m.key); setParams({ mode: m.key }); }}>{m.label}</Button>
          ))}
        </div>
        {modeInfo && <p className="mt-2 text-[13px] text-muted-foreground">Baseline parity: {modeInfo.parity} — {modeInfo.parity_note}{dash?.baseline_stale[mode] && " · Deployed prompt changed since the baseline snapshot."}</p>}
      </Section>

      <Section title="Feedback signals (last 90 days, consented only)">
        {!dash ? <Muted>Loading…</Muted> : dash.aggregates.length === 0 ? <Muted>No consented ratings yet. Demo ratings are never stored.</Muted> : (
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

      <Section title={`Draft a candidate — ${modeInfo?.label ?? mode}`}>
        <div className="space-y-3">
          <Input aria-label="Candidate label" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="min-h-11" />
          <Textarea aria-label="Candidate addendum" placeholder="Addendum text. It is added to the deployed prompt; the frozen principles are always appended last and cannot be changed." value={text} onChange={(e) => setText(e.target.value)} rows={5} />
          <Input aria-label="Rationale" placeholder="Which aggregate issue this addresses" value={rationale} onChange={(e) => setRationale(e.target.value)} className="min-h-11" />
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11 rounded-full" disabled={busy} onClick={() => run(async () => {
              const top = dash?.aggregates.find((a) => !a.suppressed);
              const r = await call({ action: "suggest_candidate", mode, target: top ? `${top.source_kind}:${top.target_kind}` : mode, reasons: top ? Object.keys(top.reasons) : [], sample_size: top?.sample_size ?? 0 });
              setText(r.suggestion);
            })}>Suggest wording</Button>
            <Button className="min-h-11 rounded-full" variant="outline" disabled={busy || !label || text.length < 20} onClick={() => run(async () => {
              await call({ action: "create_candidate", mode, label, prompt_text: text, rationale });
              setLabel(""); setText(""); setRationale("");
            })}>Save as new version</Button>
          </div>
          <Muted>Saved versions can't be edited. Changing the text creates a new version that needs its own evaluation and review.</Muted>
        </div>
      </Section>

      <Section title="Versions">
        <p className="mb-3 text-[14px]">Sandbox runtime for this mode: <span className="font-medium">{sandbox ? versionById.get(sandbox.version_id)?.label ?? sandbox.version_id : "Deployed baseline (no selection)"}</span></p>
        <ul className="space-y-3">
          {(dash?.versions ?? []).filter((v) => v.mode === mode).map((v) => {
            const vJobs = dash!.jobs.filter((j) => j.candidate_id === v.id);
            return (
              <li key={v.id} className="rounded-lg border border-btln-line p-3 text-[14px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium break-words">{v.label}{v.is_test_record && <span className="ml-2 text-[12px] text-muted-foreground">(test record)</span>}</span>
                  <span className="text-[12px] text-muted-foreground">{v.kind} · {v.model} · hash {short(v.content_hash)}</span>
                </div>
                {v.kind === "candidate" && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" className="min-h-11 rounded-full" disabled={busy} onClick={() => run(async () => { await call({ action: "evaluate", candidate_id: v.id }); })}>Evaluate</Button>
                    {vJobs.map((j) => (
                      <Button key={j.id} size="sm" variant="outline" className="min-h-11 rounded-full" onClick={() => openJobLink(j.id, j.mode)}>
                        {j.status === "running" ? `Running (${j.calls_made} calls)` : `${STATE_LABEL[j.review_state?.state] ?? j.status}: ${j.summary?.candidate_screen_passes ?? "?"}/${j.cases_total}`}
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
        <Section title={`Comparison — ${jobMode?.label ?? job.mode} · ${versionById.get(job.candidate_id)?.label ?? ""}`}>
          <div className="rounded-lg border border-btln-line p-3 text-[13px]">
            <p className="font-medium text-[14px]">{STATE_LABEL[job.review_state?.state] ?? job.review_state?.state}{job.review_state?.reason && <span className="font-normal text-muted-foreground"> — {job.review_state.reason}</span>}</p>
            <p className="mt-1 text-muted-foreground break-all">Job {job.id} · binding {short(job.binding_hash)} · baseline {short(versionById.get(job.baseline_id)?.content_hash)} · candidate {short(versionById.get(job.candidate_id)?.content_hash)} · parity {typeof job.parity === "object" ? `${job.parity?.parity} (${job.parity?.source})` : job.parity}</p>
            <p className="mt-1 text-muted-foreground">{job.calls_made} calls, {job.calls_failed} failed · {job.prompt_tokens + job.completion_tokens} tokens · cost {usd(Number(job.cost_usd))}{job.stop_reason && ` · stopped: ${job.stop_reason}`}</p>
            {job.summary && <p className="mt-1">Baseline {job.summary.baseline_screen_passes}/{job.summary.cases} vs candidate {job.summary.candidate_screen_passes}/{job.summary.cases} pass automated checks · judge preferred a failing output in {job.summary.judge_favored_failing?.length ?? 0} case(s){job.summary.incomplete && " · INCOMPLETE"}</p>}
          </div>
          <div className="mt-3 space-y-4">
            {[...byCase.entries()].map(([caseId, pair]) => {
              const meta = jobMode?.cases.find((c) => c.id === caseId);
              const input = pair.baseline?.input_case ?? pair.candidate?.input_case;
              const jr = pair.candidate?.judge ?? pair.baseline?.judge;
              const notes = (dash?.notes ?? []).filter((n) => n.job_id === job.id && n.case_id === caseId);
              return (
                <div key={caseId} className="rounded-lg border border-btln-line p-3">
                  <p className="text-[14px] font-medium">{caseId} <Muted>({meta?.kind}) — {meta?.purpose}</Muted></p>
                  {input && (
                    <details className="mt-2 text-[13px]">
                      <summary className="min-h-11 cursor-pointer py-2">Synthetic input</summary>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 text-[12px]">{JSON.stringify(input, null, 2)}</pre>
                    </details>
                  )}
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    {(["baseline", "candidate"] as const).map((variant) => {
                      const r = pair[variant];
                      return (
                        <div key={variant} className="min-w-0 rounded-md bg-muted/40 p-3 text-[13px]">
                          <p className="font-medium">{variant} — {r?.screen_passed ? "passes checks" : "fails checks"}</p>
                          <ul className="mt-1 space-y-0.5">
                            {(r?.checks ?? []).filter((c: any) => c.passed !== true).map((c: any) => <li key={c.id} className={c.hard ? "text-destructive" : "text-muted-foreground"}>{c.hard ? "✗" : "·"} {c.id}: {c.detail}</li>)}
                          </ul>
                          {r?.error_message && <p className="mt-1 text-destructive">{r.error_message}</p>}
                          <details className="mt-2" open>
                            <summary className="min-h-11 cursor-pointer py-2">Full output</summary>
                            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-[12px]">{r?.output ? JSON.stringify(r.output, null, 2) : "No output"}</pre>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                  {jr && (
                    <p className="mt-2 text-[13px] text-muted-foreground">
                      Judge (screening aid, order {jr.order ?? "?"}): prefers {jr.preferred ?? "?"}{pair.candidate?.disagreement || pair.baseline?.disagreement ? " · disagrees with the automated checks, needs human review" : ""}. {jr.reason}
                    </p>
                  )}
                  <div className="mt-2 space-y-1 text-[13px]">
                    {notes.map((n) => <p key={n.id}>Note{n.is_test_record && " (test record)"}: {n.note}</p>)}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input aria-label={`Note for ${caseId}`} placeholder="Add a note for this case" value={caseNotes[caseId] ?? ""} onChange={(e) => setCaseNotes({ ...caseNotes, [caseId]: e.target.value })} className="min-h-11" />
                      <Button size="sm" variant="outline" className="min-h-11 rounded-full" disabled={busy || !(caseNotes[caseId] ?? "").trim()} onClick={() => run(async () => { await call({ action: "add_note", job_id: job.id, case_id: caseId, note: caseNotes[caseId], expected_binding_hash: job.binding_hash }); setCaseNotes({ ...caseNotes, [caseId]: "" }); })}>Save note</Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 space-y-2">
            <Textarea aria-label="Review rationale" placeholder="Your rationale (required). Your decision is recorded against your signed-in account and this exact evaluation." value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} />
            <div className="flex flex-wrap gap-2">
              <Button className="min-h-11 rounded-full" disabled={busy || job.status !== "complete" || job.review_state?.state !== "eligible_for_review"} onClick={() => run(async () => { await call({ action: "review", job_id: job.id, decision: "approved", rationale: reviewNote, expected_binding_hash: job.binding_hash }); setReviewNote(""); })}>Approve</Button>
              <Button className="min-h-11 rounded-full" variant="outline" disabled={busy || job.status !== "complete"} onClick={() => run(async () => { await call({ action: "review", job_id: job.id, decision: "rejected", rationale: reviewNote, expected_binding_hash: job.binding_hash }); setReviewNote(""); })}>Reject</Button>
            </div>
            {dash?.reviews.filter((r) => r.job_id === job.id).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                <span>{r.decision} {new Date(r.created_at).toLocaleString()}{r.is_test_record && " (test record — not human sign-off)"} — {r.rationale}</span>
                {r.decision === "approved" && <Button size="sm" className="min-h-11 rounded-full" disabled={busy} onClick={() => run(async () => { await call({ action: "activate", environment: "sandbox", mode: job.mode, review_id: r.id, version_id: r.candidate_id }); })}>Activate in sandbox</Button>}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Sandbox runtime">
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11 rounded-full" disabled={busy} onClick={() => run(async () => { setSandboxOut(await call({ action: "sandbox_generate", mode })); })}>Run sandbox generation</Button>
          <Button className="min-h-11 rounded-full" variant="outline" disabled={busy || !sandbox} onClick={() => run(async () => { await call({ action: "rollback", environment: "sandbox", mode }); })}>Roll back sandbox</Button>
        </div>
        {sandboxOut && (
          <div className="mt-3 rounded-md bg-muted/40 p-3 text-[13px]">
            <p className="font-medium">Ran {sandboxOut.metadata.label} (hash {short(sandboxOut.metadata.content_hash)}) · {usd(sandboxOut.metadata.cost_usd)}{sandboxOut.metadata.fallback && ` — fallback: ${sandboxOut.metadata.reason}`}</p>
            <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[12px]">{JSON.stringify(sandboxOut.output, null, 2)}</pre>
          </div>
        )}
      </Section>

      <Section title="Audit (content-free)">
        <ul className="space-y-1 text-[13px] text-muted-foreground">
          {(dash?.audit ?? []).slice(0, 40).map((a) => <li key={a.id}>{new Date(a.created_at).toLocaleString()} · {a.action} · {a.entity}</li>)}
        </ul>
      </Section>
    </Shell>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-btln-line p-3"><p className="text-[12px] text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>
);
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-10"><h2 className="mb-3 text-[18px] font-medium">{title}</h2>{children}</section>
);
const Muted = ({ children }: { children: React.ReactNode }) => <span className="text-[13px] text-muted-foreground">{children}</span>;
const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen overflow-x-hidden bg-background text-foreground"><main className="mx-auto max-w-5xl px-4 py-12 sm:px-8">{children}</main></div>
);

export default AdminImprovement;
