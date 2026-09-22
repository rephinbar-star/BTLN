import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Button } from "@/components/ui/button";

type Row = {
  source_kind: string;
  target_kind: string;
  model: string | null;
  prompt_version: string | null;
  reason_code: string | null;
  up_count: number;
  down_count: number;
  sample_size: number;
};

const WINDOWS = [7, 30, 90] as const;

/**
 * Operator-only aggregate view. Never shows conversation text, names or free-text
 * feedback — only counts by mode, section, model and prompt version.
 */
const AdminFeedback = () => {
  const { isAdmin, checking: roleLoading } = useAdminRole();
  const [days, setDays] = useState<number>(30);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("admin_ai_feedback_aggregate", {
      p_days: days,
    });
    if (err) setError(err.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  // Hotspots: negative-leaning targets with enough ratings to be worth reviewing.
  const hotspots = useMemo(() => {
    const byTarget = new Map<string, { up: number; down: number; total: number }>();
    for (const row of rows) {
      if (row.reason_code) continue; // reason rows would double-count
      const key = `${row.source_kind} · ${row.target_kind} · ${row.model ?? "unknown model"} · ${row.prompt_version ?? "unversioned"}`;
      const entry = byTarget.get(key) ?? { up: 0, down: 0, total: 0 };
      entry.up += Number(row.up_count);
      entry.down += Number(row.down_count);
      entry.total += Number(row.sample_size);
      byTarget.set(key, entry);
    }
    return [...byTarget.entries()]
      .map(([key, value]) => ({
        key,
        ...value,
        downShare: value.total > 0 ? value.down / value.total : 0,
      }))
      .sort((a, b) => b.downShare - a.downShare || b.total - a.total);
  }, [rows]);

  const reasons = useMemo(
    () =>
      rows
        .filter((row) => row.reason_code)
        .sort((a, b) => Number(b.down_count) - Number(a.down_count))
        .slice(0, 25),
    [rows],
  );

  if (roleLoading) return <Shell>Checking access…</Shell>;
  if (!isAdmin)
    return (
      <Shell>
        <p>This page is for operators only.</p>
        <Link className="underline underline-offset-4" to="/">
          Back to home
        </Link>
      </Shell>
    );

  return (
    <Shell>
      <Helmet>
        <title>Feedback review | BetweenTheLines</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <h1 className="text-[26px] font-medium tracking-tight">Feedback review</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        Counts only. No conversation content, names or written feedback appear here. Negative
        results are never hidden or filtered out.
      </p>

      <div className="mt-4 flex gap-2">
        {WINDOWS.map((value) => (
          <Button
            key={value}
            variant={value === days ? "default" : "outline"}
            className="min-h-11 rounded-full"
            onClick={() => setDays(value)}
          >
            Last {value} days
          </Button>
        ))}
      </div>

      {error && <p className="mt-4 text-[14px] text-destructive">{error}</p>}
      {loading ? (
        <p className="mt-6 text-[14px] text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-[18px] font-medium">Hotspots</h2>
            {hotspots.length === 0 ? (
              <p className="mt-2 text-[14px] text-muted-foreground">No ratings in this window.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[14px]">
                  <thead className="text-[12px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="py-2">Mode · section · model · prompt</th>
                      <th className="py-2">Up</th>
                      <th className="py-2">Down</th>
                      <th className="py-2">Sample</th>
                      <th className="py-2">Negative share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotspots.map((row) => (
                      <tr key={row.key} className="border-t border-btln-line">
                        <td className="py-2 pr-4">{row.key}</td>
                        <td className="py-2">{row.up}</td>
                        <td className="py-2">{row.down}</td>
                        <td className="py-2">{row.total}</td>
                        <td className="py-2">
                          {(row.downShare * 100).toFixed(0)}%
                          {row.total < 20 && (
                            <span className="ml-2 text-[12px] text-muted-foreground">
                              small sample
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-10">
            <h2 className="text-[18px] font-medium">Reasons given</h2>
            {reasons.length === 0 ? (
              <p className="mt-2 text-[14px] text-muted-foreground">No reasons in this window.</p>
            ) : (
              <ul className="mt-3 space-y-1 text-[14px]">
                {reasons.map((row, index) => (
                  <li key={`${row.source_kind}-${row.target_kind}-${row.reason_code}-${index}`}>
                    <span className="font-medium">{row.reason_code}</span> — {row.source_kind} ·{" "}
                    {row.target_kind}: {row.down_count} down / {row.up_count} up (
                    {row.sample_size} ratings)
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="mt-10 text-[13px] text-muted-foreground">
            Ratings are a signal, not proof. A prompt change is only promoted after it passes the
            frozen Deep Read regression rubric in the evaluation harness, and promotion is manual.
          </p>
        </>
      )}
    </Shell>
  );
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background text-foreground">
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">{children}</main>
  </div>
);

export default AdminFeedback;
