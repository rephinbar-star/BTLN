import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { AXIS_DISPLAY, scoreLabel, type ScoreAxis } from "@/lib/score-labels";
import { X } from "lucide-react";
import { CoupleTypeCard, type CoupleTypeCardRelationship } from "@/components/CoupleTypeCard";
import { ShareableCard } from "@/components/chemistry/ShareableCard";
import { DeepReport, FreeInsights } from "@/pages/Report";
import type { AnalysisResult, ContextData } from "@/lib/analysis-types";

const ADMIN_AUTH_KEY = "chemistry_admin_authed";
const ADMIN_PWD_KEY = "chemistry_admin_pwd";

const DEFAULT_MODELS = [
  "anthropic/claude-sonnet-4-6",
  "openai/gpt-5",
  "google/gemini-2.5-pro",
  "x-ai/grok-4.3",
  "deepseek/deepseek-v3.2",
];

const SAMPLE_CONVERSATION = `[10/03/25, 19:04] Alex: hey, you still up for saturday?
[10/03/25, 19:22] Sam: yeah I think so, work has been brutal though
[10/03/25, 19:23] Alex: you always say that lol
[10/03/25, 19:40] Sam: I know. I'll make it work, promise
[10/03/25, 19:41] Alex: ok. would be nice to actually see you
[10/03/25, 20:15] Sam: that's a bit unfair
[10/03/25, 20:16] Alex: sorry. I just miss you
[10/03/25, 20:31] Sam: I miss you too. saturday, for real`;

const AXES: ScoreAxis[] = ["communication", "emotional_safety", "reciprocity", "spark"];

type Result = {
  state: "loading" | "done";
  ok?: boolean;
  isBaseline?: boolean;
  ms?: number;
  usage?: { total_tokens?: number; cost?: number } | null;
  content?: string;
  parsed?: any;
  jsonError?: string | null;
  error?: string;
  couple_type_id?: number | null;
};

const toCardRelationship = (t: string): CoupleTypeCardRelationship =>
  t === "romantic" || t === "friend" || t === "family" ? t : "friend";

const AdminCompare = () => {
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(SAMPLE_CONVERSATION);
  const [name1, setName1] = useState("Alex");
  const [name2, setName2] = useState("Sam");
  const [relationshipType, setRelationshipType] = useState("romantic");
  const [relationshipStage, setRelationshipStage] = useState("dating");
  const [duration, setDuration] = useState("6 months");
  const [goal, setGoal] = useState("");
  const [freeText, setFreeText] = useState("");

  const [models, setModels] = useState<string[]>(DEFAULT_MODELS);
  const [selected, setSelected] = useState<string[]>(DEFAULT_MODELS.slice(0, 3));
  const [customModel, setCustomModel] = useState("");
  const [results, setResults] = useState<Record<string, Result>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullOpen, setFullOpen] = useState(false);

  useEffect(() => {
    if (!fullOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullOpen]);

  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_AUTH_KEY) !== "true") {
      navigate(`/admin?return_to=${encodeURIComponent("/admin/compare")}`, { replace: true });
    }
  }, [navigate]);

  const toggle = (m: string) =>
    setSelected((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const addCustom = () => {
    const slug = customModel.trim();
    if (!slug) return;
    setModels((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
    setSelected((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
    setCustomModel("");
  };

  const canRun = selected.length >= 2 && selected.length <= 5 && conversation.trim().length > 0;

  const context = useMemo(
    () => ({
      name1,
      name2,
      relationship_type: relationshipType,
      relationship_stage: relationshipStage,
      duration,
      goal,
      free_text: freeText,
    }),
    [name1, name2, relationshipType, relationshipStage, duration, goal, freeText],
  );

  const reportContext = useMemo<ContextData>(
    () => ({
      name1,
      name2,
      relationship_stage: relationshipStage,
      duration,
      goal,
      free_text: freeText,
    }),
    [name1, name2, relationshipStage, duration, goal, freeText],
  );

  const modelsWithResults = selected.filter((m) => results[m]);

  const run = async () => {
    const password = sessionStorage.getItem(ADMIN_PWD_KEY) ?? "";
    if (!password) {
      navigate(`/admin?return_to=${encodeURIComponent("/admin/compare")}`, { replace: true });
      return;
    }
    setError(null);
    setRunning(true);
    setResults(Object.fromEntries(selected.map((m) => [m, { state: "loading" } as Result])));

    await Promise.allSettled(
      selected.map(async (model) => {
        try {
          const { data, error: fnErr } = await supabase.functions.invoke("compare-model", {
            body: { adminPassword: password, model, conversation, context },
          });
          if (fnErr) throw fnErr;
          setResults((prev) => ({ ...prev, [model]: { state: "done", ...(data ?? {}) } }));
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            [model]: { state: "done", ok: false, error: (err as Error).message },
          }));
        }
      }),
    );

    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-background px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Model comparison</h1>
            <p className="text-sm text-muted-foreground">
              Runs one conversation through several OpenRouter models using the live active prompt.
            </p>
          </div>
          <Link
            to="/admin"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Back to dashboard
          </Link>
        </div>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="conversation">
                Conversation — one message per line, format{" "}
                <code className="text-xs">[timestamp] Name: text</code>
              </Label>
              <Textarea
                id="conversation"
                value={conversation}
                onChange={(e) => setConversation(e.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="name1">Name 1</Label>
                <Input id="name1" value={name1} onChange={(e) => setName1(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name2">Name 2</Label>
                <Input id="name2" value={name2} onChange={(e) => setName2(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rtype">Relationship type</Label>
                <select
                  id="rtype"
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="romantic">romantic</option>
                  <option value="friend">friend</option>
                  <option value="family">family</option>
                  <option value="coworker">coworker</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stage">Relationship stage</Label>
                <Input
                  id="stage"
                  value={relationshipStage}
                  onChange={(e) => setRelationshipStage(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="duration">Duration</Label>
                <Input
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal">Goal</Label>
                <Input id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="freetext">Free text</Label>
                <Input
                  id="freetext"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Models (pick 2–5)</h2>
              <p className="text-xs text-muted-foreground">
                Model slugs drift — verify current slugs on openrouter.ai/models before trusting a
                failure.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {models.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(m)}
                    onChange={() => toggle(m)}
                    className="h-4 w-4"
                  />
                  <span className="font-mono text-xs">{m}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="vendor/model-slug"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addCustom}>
                Add
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => void run()} disabled={!canRun || running}>
                {running ? "Running…" : `Run comparison (${selected.length})`}
              </Button>
              {!canRun && (
                <span className="text-xs text-muted-foreground">
                  Select between 2 and 5 models and provide a conversation.
                </span>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        {Object.keys(results).length > 0 && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setFullOpen(true)}>
              View full reports side-by-side
            </Button>
          </div>
        )}

        {Object.keys(results).length > 0 && (
          <div className="grid gap-4 lg:grid-cols-3">
            {selected.map((model) => {
              const r = results[model];
              if (!r) return null;
              const parsed = r.parsed;
              return (
                <Card key={model} className="overflow-hidden">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-all font-mono text-xs font-semibold">{model}</span>
                      {r.isBaseline && (
                        <span className="rounded-full bg-pastel-green-bg px-2 py-0.5 text-[10px] font-medium text-pastel-green-fg-strong">
                          baseline
                        </span>
                      )}
                    </div>

                    {r.state === "loading" ? (
                      <p className="text-sm text-muted-foreground">Running…</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          {typeof r.ms === "number" && <span>{(r.ms / 1000).toFixed(1)}s</span>}
                          {r.usage?.total_tokens != null && (
                            <span>{r.usage.total_tokens} tok</span>
                          )}
                          {r.usage?.cost != null && <span>${Number(r.usage.cost).toFixed(4)}</span>}
                          <span
                            className={
                              r.ok && !r.jsonError
                                ? "rounded bg-pastel-green-bg px-1.5 text-pastel-green-fg-strong"
                                : "rounded bg-pastel-amber-bg px-1.5 text-pastel-amber-fg-strong"
                            }
                          >
                            {r.ok && !r.jsonError ? "JSON valid" : "JSON invalid"}
                          </span>
                        </div>

                        {r.error && <p className="text-xs text-destructive">{r.error}</p>}
                        {r.jsonError && (
                          <p className="text-xs text-destructive">Parse error: {r.jsonError}</p>
                        )}

                        {parsed && (
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">
                                {parsed?.headline?.tier_label ?? "—"}
                              </span>{" "}
                              <span className="text-muted-foreground">
                                ({parsed?.headline?.score ?? "—"})
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Confidence: {parsed?.meta?.analysis_confidence ?? "—"}
                            </div>
                            <ul className="space-y-1 text-xs">
                              {AXES.map((axis) => (
                                <li key={axis} className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    {AXIS_DISPLAY[axis]}
                                  </span>
                                  <span className="font-medium">
                                    {scoreLabel(axis, parsed?.sub_scores?.[axis]) ?? "—"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">
                            Raw output
                          </summary>
                          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-[10px]">
                            {parsed ? JSON.stringify(parsed, null, 2) : r.content ?? "—"}
                          </pre>
                        </details>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {fullOpen && (
        <div className="fixed inset-0 z-[100] bg-background">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <h2 className="text-sm font-semibold text-foreground">
              Full reports side-by-side ({modelsWithResults.length})
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close full report view"
              onClick={() => setFullOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex h-[calc(100vh-45px)] gap-4 overflow-x-auto p-4">
            {modelsWithResults.map((model) => {
              const r = results[model];
              const parsed = r.parsed as AnalysisResult | undefined;
              return (
                <div
                  key={model}
                  className="h-full w-[400px] shrink-0 overflow-y-auto rounded-lg border border-border bg-card"
                >
                  <div className="sticky top-0 z-10 space-y-1 border-b border-border bg-card px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-all font-mono text-xs font-semibold">{model}</span>
                      {r.isBaseline && (
                        <span className="rounded-full bg-pastel-green-bg px-2 py-0.5 text-[10px] font-medium text-pastel-green-fg-strong">
                          baseline
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {parsed?.headline?.tier_label && (
                        <span className="font-medium text-foreground">
                          {parsed.headline.tier_label} ({parsed.headline.score})
                        </span>
                      )}
                      {typeof r.ms === "number" && <span>{(r.ms / 1000).toFixed(1)}s</span>}
                      {r.usage?.total_tokens != null && <span>{r.usage.total_tokens} tok</span>}
                      {r.usage?.cost != null && <span>${Number(r.usage.cost).toFixed(4)}</span>}
                      <span
                        className={
                          r.ok && !r.jsonError
                            ? "rounded bg-pastel-green-bg px-1.5 text-pastel-green-fg-strong"
                            : "rounded bg-pastel-amber-bg px-1.5 text-pastel-amber-fg-strong"
                        }
                      >
                        {r.ok && !r.jsonError ? "JSON valid" : "JSON invalid"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-6 p-3">
                    {r.state === "loading" && (
                      <p className="text-sm text-muted-foreground">Running…</p>
                    )}
                    {r.state === "done" && !parsed && (
                      <div className="space-y-2">
                        {r.error && <p className="text-xs text-destructive">{r.error}</p>}
                        {r.jsonError && (
                          <p className="text-xs text-destructive">Parse error: {r.jsonError}</p>
                        )}
                        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-[10px]">
                          {r.content ?? "No output"}
                        </pre>
                      </div>
                    )}
                    {parsed && (
                      <>
                        {r.couple_type_id != null && (
                          <CoupleTypeCard
                            coupleTypeId={r.couple_type_id}
                            relationshipType={toCardRelationship(relationshipType)}
                            size="full"
                          />
                        )}
                        <ShareableCard result={parsed} context={reportContext} />
                        <FreeInsights result={parsed} />
                        <DeepReport result={parsed} context={reportContext} locked={false} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCompare;