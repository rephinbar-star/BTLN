import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Loader2, Upload, Users, X } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/session";
import { track } from "@/lib/analytics";
import {
  assignUnattributed,
  mergeParticipants,
  parseGroupChat,
  UnsupportedFormatError,
  type ParseResult,
} from "@/lib/group/parse";
import { GROUP_CATEGORY_LABEL, type GroupCategory } from "@/lib/group/types";
import { Link } from "react-router-dom";
import { LIMITS } from "@/lib/ingest/limits";
import { readChatFile, UnsupportedFileError } from "@/lib/ingest/file";
import type { TranscriptCandidate } from "@/lib/ingest/archive";
import {
  applyExclusions,
  buildUploadPayload,
  dayOf,
  selectRange,
} from "@/lib/ingest/aggregate";
import { setDeepReadHandoff } from "@/lib/ingest/handoff";
import { useAuth } from "@/hooks/useAuth";
import { SeeExample } from "@/components/examples/ExampleExperience";
import { ModeIntro } from "@/components/ingest/ModeIntro";
import { SharedConversationInput, emptyConversationDraft, type ConversationDraft } from "@/components/ingest/SharedConversationInput";
import { extractScreenshotConversation } from "@/lib/ingest/extract";
import { parsedFromCanonical, type CanonicalConversation } from "@/lib/ingest/canonical";
import { renameReviewedParticipant, mergeReviewedParticipants } from "@/lib/group/reviewEdits";
import { inputKey, saveReview } from "@/lib/ingest/reviewDraft";

const MIN_PARTICIPANTS = LIMITS.GROUP_MIN_PARTICIPANTS;
const MAX_PARTICIPANTS = LIMITS.GROUP_MAX_PARTICIPANTS;
const MIN_MESSAGES = LIMITS.GROUP_MIN_MESSAGES;
/** Id of a paid-for group roast placeholder. Never holds chat text. */
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

const GroupRoastStart = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  /** Kept only in memory, never persisted. */
  const pendingZip = useRef<File | null>(null);

  const [step, setStep] = useState<"input" | "review" | "confirm">("input");
  const [text, setText] = useState("");
  const [sharedDraft, setSharedDraft] = useState<ConversationDraft>(emptyConversationDraft);
  const lastRaw = useRef("");
  const lastReviewedId = useRef<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [category, setCategory] = useState<GroupCategory>("friends");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [selfAbsent, setSelfAbsent] = useState(false);
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
  const { user } = useAuth();

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
  const selectedParticipantIds = useMemo(
    () => new Set(selection.map((m) => m.participant_id).filter((id): id is string => id !== null)),
    [selection],
  );
  const selectedParticipants = useMemo(
    () => included.filter((p) => selectedParticipantIds.has(p.id)),
    [included, selectedParticipantIds],
  );

  const unattributed = useMemo(
    () =>
      parsed
        ? parsed.messages.filter((m) => m.participant_id === null && m.kind !== "system")
        : [],
    [parsed],
  );

  const syncReviewedGroup = (conversation: CanonicalConversation) => {
    const key = inputKey(sharedDraft.method, sharedDraft.method === "paste" ? sharedDraft.text : sharedDraft.importedText ?? "", sharedDraft.method === "chat_export" ? sharedDraft.importSourceName ?? null : null, sharedDraft.screenshots.map((shot) => shot.id), sharedDraft.screenshotSelfSide, sharedDraft.selfAbsent);
    setSharedDraft({ ...sharedDraft, conversation, reviewCache: saveReview(sharedDraft.reviewCache, sharedDraft.method, key, conversation), selfParticipantId: null, selfAbsent: false });
    const result = parsedFromCanonical(conversation);
    setParsed({ ...result, format: result.format === "whatsapp_ios" || result.format === "whatsapp_android" ? "whatsapp" : result.format === "imessage_csv" || result.format === "imessage_txt" ? "imessage" : "attributed_text" });
    setSelfId(null); setSelfAbsent(false);
  };

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
      logEvent("group_roast_input_parsed", { participants: result.participants.length });
      track("group_roast_started", { category });
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
    if ((!selfId && !selfAbsent) || (selfId && selfAbsent) || (selfId && !selectedParticipants.some((person) => person.id === selfId))) {
      setError("Confirm which selected participant is you, or confirm that you are not in this conversation.");
      return;
    }
    if (!user) {
      navigate(`/auth?return_to=${encodeURIComponent("/group-roast")}`);
      return;
    }
    if (selectedParticipants.length === 2) {
      setError("Group Roast is for 3 or more people. Use Deep Read for this two-person chat.");
      return;
    }
    if (selectedParticipants.length < MIN_PARTICIPANTS || selectedParticipants.length > MAX_PARTICIPANTS) {
      setError(
        `Group Roast needs between ${MIN_PARTICIPANTS} and ${MAX_PARTICIPANTS} people. Exclude people you don't want read — we never drop anyone silently.`,
      );
      return;
    }
    if (payload.coverage.analyzed_messages < MIN_MESSAGES) {
      setError(`We need at least ${MIN_MESSAGES} messages from the people and dates you kept.`);
      return;
    }
    setSubmitting(true);
    setError(null);

    const body = {
      category,
      consent: true,
      selected_period: { from: fromDay || null, to: toDay || null, keep_unknown_time: keepUnknownTime },
      participants: selectedParticipants.map((p) => ({ id: p.id, display_name: p.display_name })),
      coverage: payload.coverage,
      source_format: parsed.format,
      identity_confirmation: selfAbsent ? { absent: true } : { participant_id: selfId },
      messages: payload.messages.map((m) => ({
        participant_id: m.participant_id,
        content: m.content,
        ts: m.ts,
        order: m.order,
      })),
    };

    track("group_participants_confirmed", {
      category,
      participant_count: selectedParticipants.length,
    });

    const { data, error: fnErr } = await supabase.functions.invoke("analyze-group-roast", { body });
    if (fnErr || !data?.group_roast_id) {
      setSubmitting(false);
      const message = (fnErr as { context?: { body?: string } })?.context?.body ?? "";
      let readable = "We couldn't start your group roast. Please try again.";
      try {
        const parsedErr = JSON.parse(message) as {
          error?: string;
          code?: string;
          group_roast_id?: string;
        };
        if (parsedErr?.error) readable = parsedErr.error;
      } catch {
        /* keep default */
      }
      setError(readable);
      track("group_roast_failed", { reason_code: "start_failed" });
      return;
    }
    // Raw text never leaves this page again.
    setText("");
    setParsed(null);
    pendingZip.current = null;

    navigate(`/group-roast/${data.group_roast_id}`);

  };

  const coverage = payload?.coverage;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Group Roast — roast a chat with 3 or more people</title>
        <meta
          name="description"
          content="For group chats with 3 or more people. Import, confirm the cast and get a private evidence-grounded Group Roast."
        />
        <meta name="robots" content="noindex" />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-5xl px-5 pb-20 pt-5 sm:px-8 md:pt-12">
        <div className="md:grid md:grid-cols-2 md:items-start md:gap-8">
          <div><ModeIntro kind="group" /><div className="mt-4 hidden md:block"><SeeExample kind="group-roast" /></div></div>
          <div className="min-w-0">

        {(step === "input" || step === "review") && <section className="mt-6 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6 md:mt-0">
          <p className="mb-4 font-mono text-[11px] text-prism-amber-text">{step === "input" ? "1 Messages · 2 Check · 3 Your group" : "1 Messages · 2 Check · 3 Your group"}</p>
          <SharedConversationInput value={sharedDraft} onChange={(next) => setSharedDraft(next)}
            stage={step} accent="group" onReview={() => setStep("review")} onBack={() => setStep("input")}
            onNext={() => {
              const conversation = sharedDraft.conversation;
              if (!conversation || conversation.format === "screenshots_pending" || conversation.sourceKind !== sharedDraft.method || (!sharedDraft.selfParticipantId && !sharedDraft.selfAbsent)) return;
              const result = parsedFromCanonical(conversation);
              lastRaw.current = conversation.sourceKind === "chat_export" ? sharedDraft.importedText ?? "" : conversation.sourceKind === "paste" ? sharedDraft.text : "";
              setParsed({ ...result, format: result.format === "whatsapp_ios" || result.format === "whatsapp_android" ? "whatsapp" : result.format === "imessage_csv" || result.format === "imessage_txt" ? "imessage" : "attributed_text" });
              setText(conversation.messages.map((message) => `${message.raw_sender ?? "Unknown"}: ${message.content}`).join("\n"));
              setDayFirst(result.day_first);
              if (!parsed || sharedDraft.conversation?.id !== lastReviewedId.current) {
                setExcluded(new Set(result.participants.filter((person) => person.looks_like_system).map((person) => person.id)));
                setFromDay(""); setToDay("");
              }
              lastReviewedId.current = conversation.id;
              setSelfId(sharedDraft.selfParticipantId); setSelfAbsent(sharedDraft.selfAbsent);
              setStep("confirm");
            }} nextLabel="Continue" guidance="Keep the names visible in each screenshot."
            extractScreenshots={(screenshots, side) => extractScreenshotConversation(screenshots, side, "group")}
            screenshotMode="group" pastePlaceholder={SAMPLE} />
        </section>}
          </div>
        </div>
        <div className="mt-4 md:hidden"><SeeExample kind="group-roast" /></div>

        {step === "confirm" && parsed && coverage && (
          <section className="mt-6 space-y-4">
            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <h2 className="font-display text-[22px] font-bold">Meet your group</h2>
              <p className="mt-2 text-sm text-muted-foreground">{selectedParticipants.length} people selected · {includedMessageCount.toLocaleString()} messages selected</p>
              <p className="mt-1 text-xs text-muted-foreground">{FORMAT_LABEL[parsed.format]} · {parsed.date_range.start ? `${dayOf(parsed.date_range.start)} – ${dayOf(parsed.date_range.end)}` : "Dates not provided"}</p>
              <ul className="mt-4 flex flex-wrap gap-2">{parsed.participants.filter((person) => !excluded.has(person.id)).map((person) => <li key={person.id} className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-muted/40 px-3 text-sm"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-prism-amber/20 font-mono text-xs text-prism-amber-text">{person.display_name.slice(0, 1).toUpperCase()}</span>{person.display_name}</li>)}</ul>
              {parsed.ambiguous_dates && <p className="mt-3 text-sm text-muted-foreground">Date order was confirmed when you checked your messages. Go back to change it.</p>}

              {(!selfId && !selfAbsent) && <p role="alert" className="mt-3 text-sm text-destructive">After changing participants, go back to Check messages to confirm who you are.</p>}
            </div>

            {parsed.date_range.start && (
              <details className="rounded-lg border border-border bg-card px-4 py-2 sm:px-6">
                <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Date range and coverage</summary>
                <p className="text-sm text-muted-foreground">Which stretch should we read?</p>
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
              </details>
            )}

            <details className="rounded-lg border border-border bg-card px-4 py-2 sm:px-6">
              <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Edit group · {parsed.participants.length} found</summary>
              <p className="mt-1 text-sm text-muted-foreground">Rename, merge or exclude people. Your identity may need reconfirmation after edits.</p>

              <ul className="mt-4 divide-y divide-border">
                {parsed.participants.map((p) => {
                  const isExcluded = excluded.has(p.id);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                      <input
                        aria-label={`Name for ${p.display_name}`}
                        value={p.display_name}
                        onChange={(e) =>
                          { const conversation = sharedDraft.conversation; if (conversation) { const updated = renameReviewedParticipant(conversation, p.id, e.target.value); syncReviewedGroup(updated); lastReviewedId.current = updated.id; } }
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
                            if (sharedDraft.conversation) { const updated = mergeReviewedParticipants(sharedDraft.conversation, p.id, mergeSource); syncReviewedGroup(updated); lastReviewedId.current = updated.id; } else setParsed(merged);
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
              {(!selfId && !selfAbsent) && <p className="mt-2 text-sm text-destructive">Return to Check messages to confirm who you are.</p>}

              {parsed.participants.some((p) => p.looks_like_system) && (
                <p className="mt-3 text-[13px] text-muted-foreground">
                  We pre-excluded entries that look like bots or system notices. Undo any that are
                  real people.
                </p>
              )}

              {selectedParticipants.length > MAX_PARTICIPANTS && (
                <p className="mt-3 text-[13px] text-destructive">
                  {selectedParticipants.length} people are selected. Group Roast reads up to {MAX_PARTICIPANTS} —
                  exclude the ones you don't need, so you decide who's left out.
                </p>
              )}
            </details>

             {selectedParticipants.length === 2 && (
              <div className="rounded-lg border border-border bg-muted/40 p-4">
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
              <details className="rounded-lg border border-border bg-card px-4 py-2 sm:px-6">
                <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Assign {unattributed.length} lines with no clear sender</summary>
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
                            onClick={() => { const conversation = sharedDraft.conversation; if (conversation) { const updated = { ...conversation, messages: conversation.messages.map((message) => message.order === m.order ? { ...message, participant_id: p.id, raw_sender: p.display_name, provenance: { ...message.provenance, confidence: "confirmed" as const } } : message), participants: conversation.participants.map((person) => person.id === p.id ? { ...person, message_count: person.message_count + 1 } : person) }; syncReviewedGroup(updated); lastReviewedId.current = updated.id; } else setParsed(assignUnattributed(parsed, m.order, p.id)); }}
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
              </details>
            )}

            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <h3 className="text-sm font-semibold">What kind of group is this?</h3>
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

            {includedMessageCount < MIN_MESSAGES && (
              <p className="text-[14px] text-muted-foreground" role="status">
                Group Roast needs at least {MIN_MESSAGES} selected messages; {includedMessageCount} are selected now.
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
                  setStep("review");
                  setError(null);
                }}
                className="rounded-full border border-border px-5 py-3 text-[15px] font-medium hover:bg-muted/50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || (!selfId && !selfAbsent) || (selfId !== null && !selectedParticipants.some((person) => person.id === selfId)) || selectedParticipants.length < MIN_PARTICIPANTS || selectedParticipants.length > MAX_PARTICIPANTS || includedMessageCount < MIN_MESSAGES}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Roast my group <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <p className="text-center text-[12px] text-muted-foreground">
               {selectedParticipants.length} people · {includedMessageCount.toLocaleString()} messages · messages
              deleted after we read them
            </p>
          </section>
        )}
      </main>
    </div>
  );
};

export default GroupRoastStart;
