import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_AUTH_KEY = "chemistry_admin_authed";
const ADMIN_PWD_KEY = "chemistry_admin_pwd";

/* ---------------- Password gate ---------------- */

const PasswordGate = ({ onSuccess }: { onSuccess: () => void }) => {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        "verify-admin-password",
        { body: { password: pwd } },
      );
      if (invokeErr) throw invokeErr;
      if (data?.ok) {
        sessionStorage.setItem(ADMIN_AUTH_KEY, "true");
        sessionStorage.setItem(ADMIN_PWD_KEY, pwd);
        onSuccess();
      } else {
        setError("Incorrect password");
        setPwd("");
      }
    } catch {
      setError("Could not verify password. Try again.");
      setPwd("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
            <h1 className="text-xl font-semibold tracking-tight">BetweenTheLines™ admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the admin password to continue.
        </p>
        <div className="mt-5 space-y-2">
          <Label htmlFor="admin-pwd">Password</Label>
          <Input
            id="admin-pwd"
            type="password"
            autoFocus
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            disabled={loading}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <Button type="submit" className="mt-5 w-full" disabled={loading || !pwd}>
          {loading ? "Checking…" : "Continue"}
        </Button>
      </form>
    </div>
  );
};

/* ---------------- Helpers ---------------- */

type AnalysisRow = {
  id: string;
  status: string;
  input_method: string;
  message_count: number | null;
  error_message: string | null;
  feedback_score: number | null;
  feedback_text: string | null;
  feedback_email: string | null;
  result_json: any;
  context_data: any;
  created_at: string;
};

type EventRow = {
  session_id: string;
  event_name: string;
  created_at: string;
};

type ShareRow = {
  platform: string;
  created_at: string;
};

const daysAgoIso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const dateKey = (iso: string) => iso.slice(0, 10);

const buildLast14Days = () => {
  const out: string[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

const tierColor = (tier?: string) => {
  const t = (tier || "").toLowerCase();
  if (/(amazing|strong|great|healthy|thriving)/.test(t))
    return "bg-[hsl(var(--pastel-green-bg))] text-[hsl(var(--pastel-green-fg-strong))]";
  if (/(mixed|okay|fine|workable)/.test(t))
    return "bg-[hsl(var(--pastel-yellow-bg))] text-[hsl(var(--pastel-yellow-fg))]";
  if (/(rough|struggling|warning|concerning|red)/.test(t))
    return "bg-[hsl(var(--pastel-pink-bg))] text-[hsl(var(--pastel-pink-fg))]";
  return "bg-muted text-foreground";
};

const scoreColor = (n: number | null) => {
  if (n == null) return "bg-muted text-foreground";
  if (n >= 8) return "bg-[hsl(var(--pastel-green-bg))] text-[hsl(var(--pastel-green-fg-strong))]";
  if (n >= 5) return "bg-[hsl(var(--pastel-amber-bg))] text-[hsl(var(--pastel-amber-fg-strong))]";
  return "bg-[hsl(var(--pastel-pink-bg))] text-[hsl(var(--pastel-pink-fg))]";
};

/* ---------------- Section primitives ---------------- */

const SectionShell = ({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) => (
  <section className="space-y-4">
    <div className="flex items-end justify-between gap-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {right}
    </div>
    {children}
  </section>
);

const ErrorNote = ({ msg }: { msg: string }) => (
  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
    {msg}
  </div>
);

/* ---------------- Dashboard ---------------- */

type DashboardData = {
  events: EventRow[];
  analyses30: AnalysisRow[];
  shares: ShareRow[];
};

const Dashboard = ({ onSignOut }: { onSignOut: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [data, setData] = useState<DashboardData>({
    events: [],
    analyses30: [],
    shares: [],
  });
  const [errors, setErrors] = useState<{
    events?: string;
    analyses?: string;
    shares?: string;
  }>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErrors({});
    const since30 = daysAgoIso(30);

    const eventsP = supabase
      .from("events")
      .select("session_id,event_name,created_at")
      .gte("created_at", since30)
      .limit(10000);

    const analysesP = supabase
      .from("analyses")
      .select(
        "id,status,input_method,message_count,error_message,feedback_score,feedback_text,feedback_email,result_json,context_data,created_at",
      )
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(1000);

    const sharesP = supabase
      .from("share_clicks")
      .select("platform,created_at")
      .gte("created_at", since30)
      .limit(5000);

    const [evRes, anRes, shRes] = await Promise.all([eventsP, analysesP, sharesP]);

    const next: DashboardData = { events: [], analyses30: [], shares: [] };
    const errs: typeof errors = {};

    if (evRes.error) errs.events = evRes.error.message;
    else next.events = (evRes.data ?? []) as EventRow[];

    if (anRes.error) errs.analyses = anRes.error.message;
    else next.analyses30 = (anRes.data ?? []) as AnalysisRow[];

    if (shRes.error) errs.shares = shRes.error.message;
    else next.shares = (shRes.data ?? []) as ShareRow[];

    setData(next);
    setErrors(errs);
    setRefreshedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* --- derived metrics --- */

  const since7 = useMemo(() => Date.now() - 7 * 86400 * 1000, []);
  const since14Days = useMemo(() => buildLast14Days(), []);

  const last7Events = data.events.filter(
    (e) => new Date(e.created_at).getTime() >= since7,
  );
  const last7Analyses = data.analyses30.filter(
    (a) => new Date(a.created_at).getTime() >= since7,
  );

  const visitors7 = new Set(
    last7Events.filter((e) => e.event_name === "landing_viewed").map((e) => e.session_id),
  ).size;
  const started7 = last7Events.filter((e) => e.event_name === "analysis_started").length;
  const complete7 = last7Analyses.filter((a) => a.status === "complete").length;
  const feedback7 = last7Analyses.filter((a) => a.feedback_score != null).length;

  // Daily funnel (14 days)
  const dailyRows = since14Days.map((day) => {
    const visitorSet = new Set(
      data.events
        .filter((e) => e.event_name === "landing_viewed" && dateKey(e.created_at) === day)
        .map((e) => e.session_id),
    );
    const started = data.events.filter(
      (e) => e.event_name === "analysis_started" && dateKey(e.created_at) === day,
    ).length;
    const completed = data.analyses30.filter(
      (a) => a.status === "complete" && dateKey(a.created_at) === day,
    ).length;
    const visitors = visitorSet.size;
    const rate = started > 0 ? Math.round((completed / started) * 100) : 0;
    return { date: day.slice(5), visitors, started, completed, rate };
  });

  // Input method breakdown (30 days)
  const methodCounts = data.analyses30.reduce<Record<string, number>>((acc, a) => {
    acc[a.input_method] = (acc[a.input_method] ?? 0) + 1;
    return acc;
  }, {});
  const methodTotal = data.analyses30.length || 1;
  const methodRows = ["paste", "chat_file", "screenshot"].map((m) => ({
    method: m,
    count: methodCounts[m] ?? 0,
    pct: Math.round(((methodCounts[m] ?? 0) / methodTotal) * 100),
  }));

  // Failure analysis
  const failed30 = data.analyses30.filter((a) => a.status === "failed");
  const failureRate = data.analyses30.length
    ? (failed30.length / data.analyses30.length) * 100
    : 0;

  // Feedback
  const withFeedback = data.analyses30.filter((a) => a.feedback_score != null);
  const avgScore =
    withFeedback.length > 0
      ? withFeedback.reduce((s, a) => s + (a.feedback_score ?? 0), 0) / withFeedback.length
      : 0;
  const histogram = Array.from({ length: 10 }, (_, i) => ({
    score: i + 1,
    count: withFeedback.filter((a) => a.feedback_score === i + 1).length,
  }));
  const recentFeedback = data.analyses30
    .filter((a) => !!a.feedback_text)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 10);

  // Share metrics
  const shareTotal = data.shares.length;
  const shareByPlatform = data.shares.reduce<Record<string, number>>((acc, s) => {
    acc[s.platform] = (acc[s.platform] ?? 0) + 1;
    return acc;
  }, {});
  const sharePlatforms = ["download", "copy_link", "web_share", "x"].map((p) => ({
    platform: p,
    count: shareByPlatform[p] ?? 0,
  }));
  const totalCompleted30 = data.analyses30.filter((a) => a.status === "complete").length;
  const downloadRate =
    totalCompleted30 > 0
      ? ((shareByPlatform["download"] ?? 0) / totalCompleted30) * 100
      : 0;

  // Recent analyses (20)
  const recentAnalyses = data.analyses30
    .filter((a) => a.status === "complete")
    .slice(0, 20);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-10 px-5 py-8 sm:px-8">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">BetweenTheLines™ admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Last refreshed:{" "}
              {refreshedAt ? refreshedAt.toLocaleString() : "—"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/cards"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Card uploads
            </Link>
            <Button onClick={() => void load()} disabled={loading} size="sm">
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
            <button
              onClick={onSignOut}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* 2. Top-line metrics */}
        <SectionShell title="Last 7 days">
          {errors.events && <ErrorNote msg={`Events: ${errors.events}`} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Visitors", value: visitors7 },
              { label: "Analyses started", value: started7 },
              { label: "Analyses complete", value: complete7 },
              { label: "Feedback received", value: feedback7 },
            ].map((m) => (
              <Card key={m.label}>
                <CardContent className="p-5">
                  {loading ? (
                    <Skeleton className="h-12 w-20" />
                  ) : (
                    <div className="text-5xl font-semibold tracking-tight">{m.value}</div>
                  )}
                  <div className="mt-2 text-sm text-muted-foreground">{m.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </SectionShell>

        {/* 3. Daily funnel */}
        <SectionShell title="Daily funnel — last 14 days">
          <Card>
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer>
                    <LineChart data={dailyRows}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="visitors"
                        stroke="hsl(var(--pastel-blue-fg))"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="started"
                        stroke="hsl(var(--pastel-purple-fg))"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="completed"
                        stroke="hsl(var(--pastel-green-fg-strong))"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Visitors</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Completion %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyRows.map((r) => (
                    <TableRow key={r.date}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.visitors}</TableCell>
                      <TableCell>{r.started}</TableCell>
                      <TableCell>{r.completed}</TableCell>
                      <TableCell>{r.rate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </SectionShell>

        {/* 4. Input method breakdown */}
        <SectionShell title="Input method — last 30 days">
          <Card>
            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <div className="h-48 w-full">
                  <ResponsiveContainer>
                    <BarChart data={methodRows}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="method" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--pastel-purple-fg))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                {methodRows.map((r) => (
                  <div key={r.method} className="rounded-md bg-muted/50 p-3">
                    <div className="font-medium">{r.method}</div>
                    <div className="text-muted-foreground">
                      {r.count} ({r.pct}%)
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </SectionShell>

        {/* 5. Failure analysis */}
        <SectionShell title="Failures — last 30 days">
          {errors.analyses && <ErrorNote msg={`Analyses: ${errors.analyses}`} />}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Failure rate (last 30 days):{" "}
                <span
                  className={
                    failureRate > 5 ? "text-destructive" : "text-foreground"
                  }
                >
                  {failureRate.toFixed(1)}%
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Messages</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failed30.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No failures in last 30 days.
                      </TableCell>
                    </TableRow>
                  ) : (
                    failed30.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{formatRelative(a.created_at)}</TableCell>
                        <TableCell>{a.input_method}</TableCell>
                        <TableCell className="max-w-md truncate">
                          {a.error_message ?? "—"}
                        </TableCell>
                        <TableCell>{a.message_count ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </SectionShell>

        {/* 6. Feedback summary */}
        <SectionShell title="Feedback — last 30 days">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Score distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-5xl font-semibold tracking-tight">
                  {avgScore ? avgScore.toFixed(1) : "—"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  from {withFeedback.length} responses
                </div>
                <div className="mt-4 h-40 w-full">
                  <ResponsiveContainer>
                    <BarChart data={histogram}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="score" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--pastel-purple-fg))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent qualitative feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentFeedback.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No feedback yet.</p>
                ) : (
                  recentFeedback.map((f) => (
                    <FeedbackItem key={f.id} item={f} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </SectionShell>

        {/* 7. Share/download */}
        <SectionShell title="Share & download — last 30 days">
          {errors.shares && <ErrorNote msg={`Shares: ${errors.shares}`} />}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardContent className="p-5">
                <div className="text-sm text-muted-foreground">Download rate</div>
                <div className="mt-1 text-5xl font-semibold tracking-tight">
                  {downloadRate.toFixed(1)}%
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  downloads ÷ completed analyses
                </div>
                <div className="mt-4 text-sm">
                  Total share clicks: <span className="font-medium">{shareTotal}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardContent className="p-4">
                <div className="h-48 w-full">
                  <ResponsiveContainer>
                    <BarChart data={sharePlatforms}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="platform" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--pastel-blue-fg))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </SectionShell>

        {/* 8. Recent analyses */}
        <SectionShell title="Recent completed analyses">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Names</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Msgs</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAnalyses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No completed analyses yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentAnalyses.map((a) => {
                      const score = a.result_json?.headline?.score;
                      const tier = a.result_json?.headline?.tier_label;
                      const n1 = a.context_data?.name1 ?? "—";
                      const n2 = a.context_data?.name2 ?? "—";
                      return (
                        <TableRow key={a.id}>
                          <TableCell>{formatRelative(a.created_at)}</TableCell>
                          <TableCell>
                            {n1} &amp; {n2}
                          </TableCell>
                          <TableCell>{a.input_method}</TableCell>
                          <TableCell>{score ?? "—"}</TableCell>
                          <TableCell>
                            {tier ? (
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tierColor(
                                  tier,
                                )}`}
                              >
                                {tier}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>{a.message_count ?? "—"}</TableCell>
                          <TableCell>
                            <a
                              href={`/report/${a.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm underline underline-offset-4"
                            >
                              View
                            </a>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </SectionShell>

        <div className="pt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="underline underline-offset-4">
            ← Back to site
          </Link>
        </div>
      </div>
    </div>
  );
};

const FeedbackItem = ({ item }: { item: AnalysisRow }) => {
  const [expanded, setExpanded] = useState(false);
  const text = item.feedback_text ?? "";
  const long = text.length > 200;
  const display = expanded || !long ? text : `${text.slice(0, 200)}…`;
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${scoreColor(
            item.feedback_score,
          )}`}
        >
          {item.feedback_score ?? "—"}/10
        </span>
        <span className="text-xs text-muted-foreground">
          {formatRelative(item.created_at)}
        </span>
      </div>
      <p
        className="mt-2 text-sm leading-relaxed text-foreground"
        onClick={() => long && setExpanded((v) => !v)}
        role={long ? "button" : undefined}
        style={{ cursor: long ? "pointer" : "default" }}
      >
        {display}
      </p>
      {item.feedback_email && (
        <p className="mt-1 text-xs text-muted-foreground">{item.feedback_email}</p>
      )}
    </div>
  );
};

/* ---------------- Page ---------------- */

const Admin = () => {
  const [authed, setAuthed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(ADMIN_AUTH_KEY) === "true";
  });

  if (!authed) {
    return <PasswordGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <Dashboard
      onSignOut={() => {
        sessionStorage.removeItem(ADMIN_AUTH_KEY);
        sessionStorage.removeItem(ADMIN_PWD_KEY);
        setAuthed(false);
      }}
    />
  );
};

export default Admin;