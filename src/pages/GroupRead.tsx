import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Loader2, Upload, Users, X } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId, logEvent } from "@/lib/session";
import { track } from "@/lib/analytics";
import {
  assignUnattributed,
  mergeParticipants,
  parseGroupChat,
  UnsupportedFormatError,
  type ParseResult,
} from "@/lib/group/parse";
import { GROUP_CATEGORY_LABEL, type GroupCategory } from "@/lib/group/types";
import { useGroupAccess } from "@/hooks/useGroupAccess";
import { Link } from "react-router-dom";
import { LIMITS } from "@/lib/ingest/limits";
import { readChatFile, UnsupportedFileError } from "@/lib/ingest/file";
import { PrimeOffer } from "@/components/prime/PrimeOffer";
import type { TranscriptCandidate } from "@/lib/ingest/archive";
import {
  applyExclusions,
  buildUploadPayload,
  dayOf,
  selectRange,
} from "@/lib/ingest/aggregate";
import { setDeepReadHandoff } from "@/lib/ingest/handoff";
import { useAuth } from "@/hooks/useAuth";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";

const MIN_PARTICIPANTS = LIMITS.GROUP_MIN_PARTICIPANTS;
const MAX_PARTICIPANTS = LIMITS.GROUP_MAX_PARTICIPANTS;
const MIN_MESSAGES = LIMITS.GROUP_MIN_MESSAGES;
/** Id of a paid-for group read placeholder. Never holds chat text. */
const UNLOCK_TARGET_KEY = "btln_group_unlock_target";


const FORMAT_LABEL: Record<ParseResult["format"], string> = {
  whatsapp: "WhatsApp export",
  imessage: "iMessage export",
  attributed_text: "Pasted chat",
};

const SAMPLE = `Maya: ok who is actually coming saturday
Dev: me
Priya: yes! what time?
Maya: 7ish at mine
Sam: can't, work thing 😭
Dev: classic sam
Priya: should we do food or just snacks?
Maya: I'll sort snacks, someone bring drinks?
Dev: on it
Priya: sam we'll miss you`;

const GroupRead = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  /** Kept only in memory, never persisted. */
  const pendingZip = useRef<File | null>(null);

  const [step, setStep] = useState<"input" | "confirm">("input");
  const [text, setText] = useState("");
  const lastRaw = useRef("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [category, setCategory] = useState<GroupCategory>("friends");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<TranscriptCandidate[] | null>(null);
  const [dayFirst, setDayFirst] = useState<boolean | undefined>(undefined);
  const [fromDay, setFromDay] = useState<string>("");
  const [toDay, setToDay] = useState<string>("");
  const [keepUnknownTime, setKeepUnknownTime] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  /** Owned, server-created placeholder this checkout pays for. Id only. */
  const [unlockTarget, setUnlockTarget] = useState<string | null>(
    () => sessionStorage.getItem(UNLOCK_TARGET_KEY),
  );
  const access = useGroupAccess();
  const { user } = useAuth();
  const { openCheckout, checkoutElement, isOpen: checkoutOpen, closeCheckout } =
    useStripeCheckout();

  // Raw text never outlives this page.
  useEffect(() => () => {
    pendingZip.current = null;
  }, []);


  const included = useMemo(
    () => (parsed ? parsed.participants.filter((p) => !excluded.has(p.id)) : []),
    [parsed, excluded],
  );

  /** The exact set of messages that will be sent, after every user choice. */
  const selection = useMemo(() => {
    if (!parsed) return [];
    const withExclusions = applyExclusions(
      parsed.messages,
      parsed.participants.map((p) => ({ ...p, excluded: excluded.has(p.id) })),
    );
    const ranged = selectRange(withExclusions, {
      from: fromDay || null,
      to: toDay || null,
      keepUnknownTime,
    });
    return ranged.filter((m) => m.participant_id !== null);
  }, [parsed, excluded, fromDay, toDay, keepUnknownTime]);

  const payload = useMemo(
    () => (parsed ? buildUploadPayload(selection, included, parsed) : null),
    [parsed, selection, included],
  );

  const includedMessageCount = payload?.coverage.supplied_messages ?? 0;

  const unattributed = useMemo(
    () =>
      parsed
        ? parsed.messages.filter((m) => m.participant_id === null && m.kind !== "system")
        : [],
    [parsed],
  );

  const doParse = (raw: string, opts?: { dayFirst?: boolean }) => {
    setError(null);
    lastRaw.current = raw;
    if (raw.trim().length === 0) {
      setError("Paste a group chat first.");
      return;
    }
    if (raw.length > LIMITS.MAX_TEXT_CHARS) {
      setError("That chat is larger than we can read. Export a shorter date range.");
      return;
    }
    try {
      const result = parseGroupChat(raw, { dayFirst: opts?.dayFirst ?? dayFirst });
      setParsed(result);
      setDayFirst(result.day_first);
      setExcluded(new Set(result.participants.filter((p) => p.looks_like_system).map((p) => p.id)));
      setSelfId(null);
      setFromDay("");
      setToDay("");
      setStep("confirm");
      logEvent("group_read_input_parsed", { participants: result.participants.length });
      track("group_read_started", { category });
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } catch (e) {
      setError(
        e instanceof UnsupportedFormatError
          ? e.message
          : "We couldn't read that. Try pasting the chat as text.",
      );
    }
  };

  const onFile = async (file: File, entryName?: string) => {
    setError(null);
    setNotices([]);
    try {
      const result = await readChatFile(file, entryName);
      if (result.kind === "choose") {
        pendingZip.current = file;
        setCandidates(result.candidates);
        setNotices(result.warnings);
        return;
      }
      setCandidates(null);
      pendingZip.current = null;
      setNotices(result.warnings);
      doParse(result.text);
    } catch (e) {
      setCandidates(null);
      pendingZip.current = null;
      setError(
        e instanceof UnsupportedFileError
          ? e.message
          : "We couldn't open that file. Try a .txt, .csv or WhatsApp .zip export.",
      );
    }
  };

  const continueAsDeepRead = () => {
    if (!parsed) return;
    const nameOf = new Map(parsed.participants.map((p) => [p.id, p.display_name]));
    const lines = selection.map((m) => `${nameOf.get(m.participant_id!) ?? "?"}: ${m.content}`);
    setDeepReadHandoff(lines.join("\n"));
    setText("");
    setParsed(null);
    navigate("/deep?from=import");
  };

  const submit = async () => {
    if (!parsed || !payload) return;
    if (included.length === 2) {
      setError("This is a two-person chat — use Deep Read for it.");
      return;
    }
    if (included.length < MIN_PARTICIPANTS || included.length > MAX_PARTICIPANTS) {
      setError(
        `Group Read needs between ${MIN_PARTICIPANTS} and ${MAX_PARTICIPANTS} people. Exclude people you don't want read — we never drop anyone silently.`,
      );
      return;
    }
    if (payload.coverage.analyzed_messages < MIN_MESSAGES) {
      setError(`We need at least ${MIN_MESSAGES} messages from the people and dates you kept.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    setLocked(false);

    const body = {
      session_id: getSessionId(),
      category,
      // When a single report has been paid for, run it against that exact
      // owned target so the payment is honoured and never double-charged.
      ...(unlockTarget ? { group_read_id: unlockTarget } : {}),
      participants: included.map((p) => ({ id: p.id, display_name: p.display_name })),
      coverage: payload.coverage,
      source_format: parsed.format,
      messages: payload.messages.map((m) => ({
        participant_id: m.participant_id,
        content: m.content,
        ts: m.ts,
        order: m.order,
      })),
    };

    track("group_participants_confirmed", {
      category,
      participant_count: included.length,
    });

    const { data, error: fnErr } = await supabase.functions.invoke("analyze-group", { body });
    if (fnErr || !data?.group_read_id) {
      setSubmitting(false);
      const message = (fnErr as { context?: { body?: string } })?.context?.body ?? "";
      let readable = "We couldn't start your group read. Please try again.";
      try {
        const parsedErr = JSON.parse(message) as {
          error?: string;
          code?: string;
          group_read_id?: string;
        };
        if (parsedErr?.error) readable = parsedErr.error;
        if (
          parsedErr?.code === "subscription_required" ||
          parsedErr?.code === "payment_required" ||
          parsedErr?.code === "payment_pending"
        ) {
          setLocked(true);
          if (parsedErr.group_read_id) {
            setUnlockTarget(parsedErr.group_read_id);
            sessionStorage.setItem(UNLOCK_TARGET_KEY, parsedErr.group_read_id);
          }
          track("group_paywall_viewed", {});
        }
      } catch {
        /* keep default */
      }
      setError(readable);
      track("group_read_failed", { reason_code: "start_failed" });
      return;
    }
    // Raw text never leaves this page again.
    setText("");
    setParsed(null);
    pendingZip.current = null;
    if (unlockTarget) {
      sessionStorage.removeItem(UNLOCK_TARGET_KEY);
      setUnlockTarget(null);
    }
    navigate(`/group/${data.group_read_id}`);

  };

  const coverage = payload?.coverage;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Group Read — see how your group chat really works | BetweenTheLines</title>
        <meta
          name="description"
          content="Paste a group chat and get playful role cards plus a serious look at balance, unanswered questions and how the group repairs."
        />
        <meta name="robots" content="noindex" />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-8">
        <p className="text-sm text-muted-foreground">Group Read</p>
        <h1 className="mt-3 text-[30px] font-medium leading-tight tracking-tight sm:text-[38px]">
          Who's really running your group chat?
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
          Paste a friends, family or work chat with 3–15 people. You'll confirm who's who before
          anything is analysed, and the messages are deleted after we read them.
        </p>

        {step === "input" && (
          <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv,text/plain,text/csv,.zip,application/zip,application/x-zip-compressed"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              aria-label="Paste your group chat"
              placeholder={SAMPLE}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[14px] font-medium hover:bg-muted/50"
              >
                <Upload className="h-4 w-4" /> Upload an export
              </button>
              <button
                type="button"
                onClick={() => setText(SAMPLE)}
                className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Use an example
              </button>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              Works with WhatsApp exports from iPhone and Android (.txt, or the .zip — photos inside
              are ignored, never opened), and iMessage transcripts saved as .txt or .csv with
              date, sender and message columns. We can't read Apple's chat.db file or app backups.
            </p>

            {notices.length > 0 && (
              <ul className="mt-3 space-y-1 text-[13px] text-muted-foreground">
                {notices.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}

            {candidates && (
              <div className="mt-4 rounded-xl border border-border p-4">
                <p className="text-[14px] font-medium">
                  That archive has more than one chat in it
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Pick the one you want — we won't join different chats together.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidates.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        const f = pendingZip.current;
                        if (f) void onFile(f, c.name);
                      }}
                      className="rounded-full border border-border px-3 py-1.5 text-[13px] hover:bg-muted/50"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 flex items-start gap-2 text-[14px] text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => doParse(text)}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90"
            >
              Find the people <ArrowRight className="h-4 w-4" />
            </button>
          </section>
        )}

        {step === "confirm" && parsed && coverage && (
          <section className="mt-8 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="text-[18px] font-medium">Here's what we read</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px] sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Source</dt>
                  <dd>{FORMAT_LABEL[parsed.format]}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Messages found</dt>
                  <dd className="tabular-nums">{parsed.messages.length.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">People found</dt>
                  <dd className="tabular-nums">{parsed.participants.length}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Dates covered</dt>
                  <dd>
                    {parsed.date_range.start
                      ? `${dayOf(parsed.date_range.start)} → ${dayOf(parsed.date_range.end)}`
                      : "No dates in this export"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">No sender</dt>
                  <dd className="tabular-nums">{parsed.unattributed_count}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Attachments / system</dt>
                  <dd className="tabular-nums">
                    {parsed.attachment_count} / {parsed.system_count}
                  </dd>
                </div>
              </dl>

              {parsed.warnings.length > 0 && (
                <ul className="mt-3 space-y-1 text-[13px] text-muted-foreground">
                  {parsed.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}

              {parsed.ambiguous_dates && (
                <div className="mt-4 rounded-xl border border-border p-4">
                  <p className="text-[14px] font-medium">Is 03/04 the 3rd of April, or March 4th?</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    This export doesn't say. Pick the one that matches your phone.
                  </p>
                  <div className="mt-3 flex gap-2">
                    {[
                      { label: "Day first (3 April)", value: true },
                      { label: "Month first (March 4)", value: false },
                    ].map((o) => (
                      <button
                        key={String(o.value)}
                        type="button"
                        aria-pressed={dayFirst === o.value}
                        onClick={() => {
                          setDayFirst(o.value);
                          doParse(lastRaw.current || text, { dayFirst: o.value });
                        }}
                        disabled={!lastRaw.current && !text}
                        className={`rounded-full border px-3 py-1.5 text-[13px] ${
                          dayFirst === o.value
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground hover:text-foreground"
                        } disabled:opacity-40`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {parsed.messages_with_time > 0 && (
                <p className="mt-3 text-[13px] text-muted-foreground">
                  Times come from the export with no timezone attached, so we read them exactly as
                  written.
                </p>
              )}
            </div>

            {parsed.date_range.start && (
              <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <h2 className="text-[18px] font-medium">Which stretch should we read?</h2>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[14px]">
                  <label className="flex items-center gap-2">
                    From
                    <input
                      type="date"
                      value={fromDay}
                      onChange={(e) => setFromDay(e.target.value)}
                      className="rounded-lg border border-border bg-background px-3 py-2"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    To
                    <input
                      type="date"
                      value={toDay}
                      onChange={(e) => setToDay(e.target.value)}
                      className="rounded-lg border border-border bg-background px-3 py-2"
                    />
                  </label>
                  {(fromDay || toDay) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFromDay("");
                        setToDay("");
                      }}
                      className="text-[13px] text-muted-foreground underline-offset-4 hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
                {coverage.without_time > 0 && (
                  <label className="mt-3 flex items-start gap-2 text-[13px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={keepUnknownTime}
                      onChange={(e) => setKeepUnknownTime(e.target.checked)}
                      className="mt-0.5"
                    />
                    Keep the {coverage.without_time} messages with no time on them (they stay in
                    order; unticking leaves them out entirely).
                  </label>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-[18px] font-medium">
                <Users className="h-4 w-4" /> We found {parsed.participants.length} people
              </h2>
              <p className="mt-1 text-[14px] text-muted-foreground">
                Merge duplicates, drop bots and system entries, and tell us which one is you
                (optional). {includedMessageCount.toLocaleString()} messages from {included.length}{" "}
                people are selected.
              </p>

              <ul className="mt-4 divide-y divide-border">
                {parsed.participants.map((p) => {
                  const isExcluded = excluded.has(p.id);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                      <input
                        aria-label={`Name for ${p.display_name}`}
                        value={p.display_name}
                        onChange={(e) =>
                          setParsed({
                            ...parsed,
                            participants: parsed.participants.map((x) =>
                              x.id === p.id ? { ...x, display_name: e.target.value } : x,
                            ),
                          })
                        }
                        className={`min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[15px] ${
                          isExcluded ? "opacity-40 line-through" : ""
                        }`}
                      />
                      <span className="text-[13px] tabular-nums text-muted-foreground">
                        {p.message_count} msg
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelfId(selfId === p.id ? null : p.id)}
                        aria-pressed={selfId === p.id}
                        className={`rounded-full border px-3 py-1 text-[13px] ${
                          selfId === p.id
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        This is me
                      </button>
                      <button
                        type="button"
                        onClick={() => setMergeSource(mergeSource === p.id ? null : p.id)}
                        aria-pressed={mergeSource === p.id}
                        className={`rounded-full border px-3 py-1 text-[13px] ${
                          mergeSource === p.id
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {mergeSource === p.id ? "Pick who to merge into" : "Same as…"}
                      </button>
                      <button
                        type="button"
                        aria-label={isExcluded ? `Include ${p.display_name}` : `Exclude ${p.display_name}`}
                        onClick={() => {
                          const next = new Set(excluded);
                          if (isExcluded) next.delete(p.id);
                          else next.add(p.id);
                          setExcluded(next);
                        }}
                        className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {mergeSource && mergeSource !== p.id && (
                        <button
                          type="button"
                          onClick={() => {
                            const merged = mergeParticipants(parsed, p.id, mergeSource);
                            setParsed(merged);
                            if (selfId === mergeSource) setSelfId(p.id);
                            const next = new Set(excluded);
                            next.delete(mergeSource);
                            setExcluded(next);
                            setMergeSource(null);
                          }}
                          className="rounded-full bg-muted px-3 py-1 text-[13px] font-medium"
                        >
                          Merge into this
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              {parsed.participants.some((p) => p.looks_like_system) && (
                <p className="mt-3 text-[13px] text-muted-foreground">
                  We pre-excluded entries that look like bots or system notices. Undo any that are
                  real people.
                </p>
              )}

              {included.length > MAX_PARTICIPANTS && (
                <p className="mt-3 text-[13px] text-destructive">
                  {included.length} people are selected. Group Read reads up to {MAX_PARTICIPANTS} —
                  exclude the ones you don't need, so you decide who's left out.
                </p>
              )}
            </div>

            {included.length === 2 && (
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-[15px] font-medium">This is a two-person chat</p>
                <p className="mt-2 text-[14px] text-muted-foreground">
                  Deep Read is built for two people and will tell you far more. Your import carries
                  over — nothing is re-uploaded or saved on the way.
                </p>
                <button
                  type="button"
                  onClick={continueAsDeepRead}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-[14px] font-medium text-background"
                >
                  Continue as a Deep Read <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {unattributed.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <h2 className="text-[18px] font-medium">
                  {unattributed.length} lines have no clear sender
                </h2>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  We won't guess who wrote them. Assign them, or leave them out.
                </p>
                <ul className="mt-4 space-y-3">
                  {unattributed.slice(0, 10).map((m) => (
                    <li key={m.order} className="rounded-xl border border-border p-3">
                      <p className="text-[14px] text-foreground">{m.content.slice(0, 200)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {included.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setParsed(assignUnattributed(parsed, m.order, p.id))}
                            className="rounded-full border border-border px-3 py-1 text-[13px] text-muted-foreground hover:text-foreground"
                          >
                            {p.display_name}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
                {unattributed.length > 10 && (
                  <p className="mt-3 text-[13px] text-muted-foreground">
                    Showing the first 10. The rest stay out of the analysis.
                  </p>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="text-[18px] font-medium">What kind of group is this?</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(GROUP_CATEGORY_LABEL) as GroupCategory[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    aria-pressed={category === c}
                    className={`rounded-full border px-4 py-2 text-[14px] ${
                      category === c
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {GROUP_CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
              {category === "work" && (
                <p className="mt-3 text-[13px] text-muted-foreground">
                  Work groups get communication habits only — no performance ratings and no advice
                  about anyone's job.
                </p>
              )}
            </div>

            {coverage.sampled && (
              <p className="text-[13px] text-muted-foreground">
                You've selected {coverage.supplied_messages.toLocaleString()} messages. Counts and
                balance are worked out across{" "}
                {coverage.analyzed_messages.toLocaleString()} of them, and the write-up quotes from
                the most recent {LIMITS.MAX_MODEL_SAMPLE_MESSAGES.toLocaleString()} — your report
                says the same.
              </p>
            )}

            {(locked || (!access.isLoading && access.needsSubscription)) && (
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-[15px] font-medium">You've used your free group read</p>
                <p className="mt-2 text-[14px] text-muted-foreground">
                  Unlimited group reads come with a monthly or annual BetweenTheLines plan,
                  alongside full Deep Read reports. Or unlock just this one report. Your
                  finished reads stay available either way.
                </p>
                <PrimeOffer className="mt-4" returnTo="/group" />
                {checkoutOpen ? (
                  <div className="mt-4">
                    {checkoutElement}
                    <button
                      type="button"
                      onClick={closeCheckout}
                      className="mt-3 w-full text-center text-[13px] text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {user && unlockTarget && (
                      <button
                        type="button"
                        onClick={() =>
                          openCheckout({
                            priceId: "BTLN_report_unlock",
                            reportKind: "group_read",
                            groupReadId: unlockTarget,
                            customerEmail: user.email ?? undefined,
                            userId: user.id,
                            returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}&group_read_id=${unlockTarget}`,
                          })
                        }
                        className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-[14px] font-medium text-background"
                      >
                        Unlock this group report — $4.99
                      </button>
                    )}
                    {!user && (
                      <Link
                        to={`/auth?return_to=${encodeURIComponent("/group")}`}
                        className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-[14px] font-medium text-background"
                      >
                        Sign in to unlock this one <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                    <Link
                      to="/pricing"
                      onClick={() => track("group_paywall_viewed", {})}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-[14px] font-medium hover:bg-muted/50"
                    >
                      See plans <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
                {user && unlockTarget && (
                  <p className="mt-3 text-[13px] text-muted-foreground">
                    After paying you'll come back here and add the chat again — we never keep a
                    copy of your conversation.
                  </p>
                )}
              </div>
            )}

            {!access.isLoading && !access.entitled && !access.needsSubscription && (
              <p className="text-[13px] text-muted-foreground">
                Your first group read is free. After that it's $4.99 for a single report, or a
                plan for unlimited.
              </p>
            )}


            {error && (
              <p className="flex items-start gap-2 text-[14px] text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep("input");
                  setError(null);
                }}
                className="rounded-full border border-border px-5 py-3 text-[15px] font-medium hover:bg-muted/50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Read this group <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <p className="text-center text-[12px] text-muted-foreground">
              {included.length} people · {includedMessageCount.toLocaleString()} messages · messages
              deleted after we read them
            </p>
          </section>
        )}
      </main>
    </div>
  );
};

export default GroupRead;
