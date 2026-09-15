import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import * as htmlToImage from "html-to-image";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Link2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { track } from "@/lib/analytics";
import {
  GROUP_CATEGORY_LABEL,
  METRIC_LABEL,
  type GroupCategory,
  type GroupResultJson,
  type GroupStatsJson,
} from "@/lib/group/types";
import { GroupOverallCard, GroupRoleShareCard } from "@/components/group/GroupShareCard";

const POLL_MS = 2500;
const TIMEOUT_MS = 180_000;

type Row = {
  id: string;
  status: string;
  category: GroupCategory;
  participant_count: number;
  message_count: number;
  result_json: GroupResultJson | null;
  stats_json: GroupStatsJson | null;
  error_message: string | null;
};

const GroupResult = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [row, setRow] = useState<Row | null>(null);
  const rowRef = useRef<Row | null>(null);
  useEffect(() => {
    rowRef.current = row;
  }, [row]);
  const [timedOut, setTimedOut] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [includeNames, setIncludeNames] = useState(false);
  const [includeQuotes, setIncludeQuotes] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const emptyLoads = useRef(0);
  const startedAt = useRef(Date.now());
  const completedTracked = useRef(false);

  const overallRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);
  const [roleForExport, setRoleForExport] = useState<{
    label: string;
    role: string;
    headline: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!groupId) return;
    const { data } = await supabase.rpc("get_group_read_for_session", {
      p_id: groupId,
      p_session_id: getSessionId(),
    });
    const r = (Array.isArray(data) ? data[0] : data) as Row | undefined;
    if (r) {
      setRow(r);
      setNotFound(false);
    } else {
      emptyLoads.current += 1;
      if (emptyLoads.current >= 3) setNotFound(true);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      const status = rowRef.current?.status;
      if (status === "complete" || status === "failed") {
        window.clearInterval(t);
        return;
      }
      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        setTimedOut(true);
        window.clearInterval(t);
        return;
      }
      void load();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (row?.status === "complete" && !completedTracked.current) {
      completedTracked.current = true;
      track("group_read_completed", {
        group_read_id: row.id,
        participant_count: row.participant_count,
        safety_mode: row.result_json?.safety_mode === true,
      });
    }
    if (row?.status === "failed" && !completedTracked.current) {
      completedTracked.current = true;
      track("group_read_failed", { reason_code: "generation_failed" });
    }
  }, [row]);

  const result = row?.result_json ?? null;
  const stats = row?.stats_json ?? null;
  const nameById = new Map((result?.participants ?? []).map((p) => [p.id, p.display_name]));

  const createShare = async () => {
    if (!groupId) return;
    setSharing(true);
    setShareError(null);
    const { data, error } = await supabase.functions.invoke("group-share", {
      body: {
        action: "create",
        group_read_id: groupId,
        session_id: getSessionId(),
        include_names: includeNames,
        include_quotes: includeQuotes,
      },
    });
    setSharing(false);
    if (error || !data?.token) {
      setShareError("We couldn't create that link. Please try again.");
      return;
    }
    setShareToken(data.token as string);
    track("group_share_created", {
      group_read_id: groupId,
      include_names: includeNames,
      include_quotes: includeQuotes,
    });
  };

  const revokeShare = async () => {
    if (!groupId) return;
    setSharing(true);
    await supabase.functions.invoke("group-share", {
      body: { action: "revoke", group_read_id: groupId, session_id: getSessionId() },
    });
    setSharing(false);
    setShareToken(null);
  };

  const shareUrl = shareToken ? `${window.location.origin}/g/${shareToken}` : null;

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const exportNode = async (node: HTMLDivElement | null, filename: string, fmt: "square" | "story") => {
    if (!node) return;
    setExporting(filename);
    try {
      const dataUrl = await htmlToImage.toPng(node, { pixelRatio: 1, cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
      track("group_role_card_engaged", { format: fmt });
    } finally {
      setExporting(null);
    }
  };

  // ---- states -------------------------------------------------------------

  if (!row && notFound) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="text-[20px] font-medium">We can't find that group read</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Group reads are private to the device that made them, so this one isn't yours to open.
          </p>
          <Link
            to="/group"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background"
          >
            Read your own group chat
          </Link>
        </div>
      </Shell>
    );
  }

  if (!row) {
    return (
      <Shell>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your group read…
        </div>
      </Shell>
    );
  }

  if (row.status === "failed" || (timedOut && row.status !== "complete")) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="flex items-center gap-2 text-[20px] font-medium">
            <AlertTriangle className="h-5 w-5 text-destructive" /> That didn't finish
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {row.error_message ?? "It took longer than expected."}
          </p>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Your messages were already deleted, so you'll need to paste the chat again.
          </p>
          <Link
            to="/group"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background"
          >
            <RefreshCw className="h-4 w-4" /> Start again
          </Link>
        </div>
      </Shell>
    );
  }

  if (row.status !== "complete" || !result) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="flex items-center gap-2 text-[20px] font-medium">
            <Loader2 className="h-5 w-5 animate-spin" /> Reading your group…
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Counting who says what, then working out the roles. This takes about a minute.
          </p>
        </div>
      </Shell>
    );
  }

  const coverage = result.coverage;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Your Group Read | BetweenTheLines</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-8">
        <p className="text-sm text-muted-foreground">
          Group Read · {GROUP_CATEGORY_LABEL[row.category]}
        </p>
        <h1 className="mt-3 text-[30px] font-medium leading-tight tracking-tight sm:text-[38px]">
          {result.group_title ?? "Your group read"}
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
          {result.group_summary}
        </p>

        {result.safety_mode && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-[14px] text-foreground">
              Some of this chat looked serious, so we've kept the read plain and left the jokes
              out. If anyone is at risk, please reach out to someone who can help in person.
            </p>
          </div>
        )}

        {/* Role cards */}
        <section className="mt-10">
          <h2 className="text-[20px] font-medium">Everyone's role</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Playful descriptions of how people show up in the chat — not judgements about them.
          </p>
          <ul className="mt-4 space-y-3">
            {(result.role_cards ?? []).map((c, i) => {
              const label = nameById.get(c.participant_id ?? "") ?? `Participant ${i + 1}`;
              const s = stats?.participants?.find((p) => p.id === c.participant_id);
              return (
                <li key={`${c.participant_id}-${i}`} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[18px] font-medium">
                      {label} · <span className="text-muted-foreground">{c.role}</span>
                    </h3>
                    {s && (
                      <span className="text-[13px] tabular-nums text-muted-foreground">
                        {s.messages} msg · {s.share_pct}%
                      </span>
                    )}
                  </div>
                  {c.headline && <p className="mt-2 text-[16px]">{c.headline}</p>}
                  {c.why && <p className="mt-2 text-[15px] text-muted-foreground">{c.why}</p>}
                  {c.evidence && (
                    <p className="mt-2 border-l-2 border-border pl-3 text-[14px] italic text-muted-foreground">
                      {c.evidence}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      setRoleForExport({
                        label,
                        role: c.role ?? "Group member",
                        headline: c.headline ?? "",
                      });
                      await new Promise((r) => window.setTimeout(r, 60));
                      await exportNode(roleRef.current, `group-role-${i + 1}.png`, "square");
                      setRoleForExport(null);
                    }}
                    disabled={exporting !== null}
                    className="mt-3 inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40"
                  >
                    <Download className="h-3.5 w-3.5" /> Save this role card
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Serious layer */}
        <section className="mt-10 space-y-3">
          <h2 className="text-[20px] font-medium">The serious bit</h2>
          {[
            ["Balance", result.balance?.note],
            ["Who starts things", result.initiation?.note],
            ["Questions that went unanswered", result.unanswered?.note],
            ["Repair", result.repair?.note],
          ]
            .filter(([, v]) => typeof v === "string" && v.length > 0)
            .map(([k, v]) => (
              <div key={k as string} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-[15px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {k}
                </h3>
                <p className="mt-2 text-[16px]">{v}</p>
              </div>
            ))}

          {(result.group_strengths?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-[15px] font-semibold uppercase tracking-wide text-muted-foreground">
                Strengths
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[16px]">
                {result.group_strengths!.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {(result.subgroups?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-[15px] font-semibold uppercase tracking-wide text-muted-foreground">
                Possible sub-groups
              </h3>
              <ul className="mt-2 space-y-2 text-[16px]">
                {result.subgroups!.map((s, i) => (
                  <li key={i}>
                    {s.note}{" "}
                    <span className="text-[13px] text-muted-foreground">
                      ({s.confidence ?? "low"} confidence)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(result.suggestions?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-[15px] font-semibold uppercase tracking-wide text-muted-foreground">
                What might help
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[16px]">
                {result.suggestions!.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {(result.alternatives?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-[15px] font-semibold uppercase tracking-wide text-muted-foreground">
                Other ways to read this
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-muted-foreground">
                {result.alternatives!.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Coverage */}
        <section className="mt-10 rounded-2xl border border-border bg-muted/30 p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-4 w-4" /> What this is based on
          </h2>
          <ul className="mt-2 space-y-1 text-[14px] text-muted-foreground">
            <li>
              {coverage?.messages_analyzed ?? row.message_count} messages from{" "}
              {row.participant_count} people
              {coverage?.truncated ? " (most recent stretch only)" : ""}
            </li>
            <li>Confidence: {result.confidence ?? "medium"}</li>
            {(coverage?.unattributed_messages ?? 0) > 0 && (
              <li>{coverage!.unattributed_messages} lines had no clear sender and were left out</li>
            )}
            {(coverage?.unavailable_metrics ?? []).map((m) => (
              <li key={m}>Not available: {METRIC_LABEL[m] ?? m}</li>
            ))}
          </ul>
        </section>

        {!result.safety_mode && (
          <section className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-[18px] font-medium">Want the funny version?</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Roast Us turns this read into a warm, silly one — with one useful thing at the end. It
              uses this report, not your chat.
            </p>
            <Link
              to={`/roast?source=group_read&id=${row.id}`}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-[15px] font-medium hover:bg-muted/50"
            >
              Roast us
            </Link>
          </section>
        )}

        {/* Sharing */}
        <section className="mt-10 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-[20px] font-medium">Share it</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Sharing is off until you turn it on. By default everyone shows up as “Participant A”,
            with no names, no quotes and no chat text.
          </p>

          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-3 text-[15px]">
              <input
                type="checkbox"
                checked={includeNames}
                onChange={(e) => setIncludeNames(e.target.checked)}
                className="h-4 w-4"
              />
              Show real names
            </label>
            <label className="flex items-center gap-3 text-[15px]">
              <input
                type="checkbox"
                checked={includeQuotes}
                onChange={(e) => setIncludeQuotes(e.target.checked)}
                className="h-4 w-4"
              />
              Include the short evidence quotes
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={createShare}
              disabled={sharing}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-[15px] font-medium text-background disabled:opacity-40"
            >
              {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {shareToken ? "Create a new link" : "Create a share link"}
            </button>
            {shareToken && (
              <button
                type="button"
                onClick={revokeShare}
                className="rounded-full border border-border px-5 py-3 text-[15px] font-medium hover:bg-muted/50"
              >
                Turn sharing off
              </button>
            )}
            <button
              type="button"
              onClick={() => exportNode(overallRef.current, "group-read.png", "story")}
              disabled={exporting !== null}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-[15px] font-medium hover:bg-muted/50 disabled:opacity-40"
            >
              <Download className="h-4 w-4" /> Save the group card
            </button>
          </div>

          {shareUrl && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3">
              <code className="min-w-0 flex-1 truncate text-[13px]">{shareUrl}</code>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[13px]"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <button
                  type="button"
                  onClick={() => navigator.share({ url: shareUrl, title: "Our Group Read" })}
                  className="rounded-full border border-border px-3 py-1.5 text-[13px]"
                >
                  Share
                </button>
              )}
            </div>
          )}
          {shareError && <p className="mt-3 text-[14px] text-destructive">{shareError}</p>}
        </section>

        <p className="mt-8 text-center text-[13px] text-muted-foreground">
          The messages you pasted were deleted after we read them. Only this report is stored.
        </p>
      </main>

      {/* Off-screen export nodes */}
      <div className="pointer-events-none fixed -left-[10000px] top-0" aria-hidden>
        <GroupOverallCard
          ref={overallRef}
          title={result.group_title ?? "Group Read"}
          subtitle={result.group_summary ?? ""}
          category={row.category}
          participantCount={row.participant_count}
          roles={(result.role_cards ?? []).map((c, i) => ({
            label: includeNames
              ? (nameById.get(c.participant_id ?? "") ?? `Participant ${i + 1}`)
              : `Participant ${String.fromCharCode(65 + i)}`,
            role: c.role ?? "Group member",
          }))}
        />
        {roleForExport && (
          <GroupRoleShareCard
            ref={roleRef}
            label={roleForExport.label}
            role={roleForExport.role}
            headline={roleForExport.headline}
            category={row.category}
          />
        )}
      </div>

      <Footer />
    </div>
  );
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background text-foreground">
    <Helmet>
      <title>Your Group Read | BetweenTheLines</title>
      <meta name="robots" content="noindex" />
    </Helmet>
    <Header />
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-16 sm:px-8">{children}</main>
    <Footer />
  </div>
);

export default GroupResult;
