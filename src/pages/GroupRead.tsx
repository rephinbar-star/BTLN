import { useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Loader2, Upload, Users, X } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
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

const MIN_PARTICIPANTS = 3;
const MAX_PARTICIPANTS = 15;
const MIN_MESSAGES = 10;
const MAX_INPUT_CHARS = 400_000;

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

  const [step, setStep] = useState<"input" | "confirm">("input");
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [category, setCategory] = useState<GroupCategory>("friends");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const included = useMemo(
    () => (parsed ? parsed.participants.filter((p) => !excluded.has(p.id)) : []),
    [parsed, excluded],
  );

  const includedMessageCount = useMemo(() => {
    if (!parsed) return 0;
    const ids = new Set(included.map((p) => p.id));
    return parsed.messages.filter((m) => m.participant_id && ids.has(m.participant_id)).length;
  }, [parsed, included]);

  const unattributed = useMemo(
    () => (parsed ? parsed.messages.filter((m) => m.participant_id === null) : []),
    [parsed],
  );

  const doParse = (raw: string) => {
    setError(null);
    if (raw.trim().length === 0) {
      setError("Paste a group chat first.");
      return;
    }
    if (raw.length > MAX_INPUT_CHARS) {
      setError("That chat is very large. Paste a shorter stretch (a few weeks works well).");
      return;
    }
    try {
      const result = parseGroupChat(raw);
      setParsed(result);
      setExcluded(new Set(result.participants.filter((p) => p.looks_like_system).map((p) => p.id)));
      setSelfId(null);
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

  const onFile = async (file: File) => {
    setError(null);
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".txt")) {
        doParse(await file.text());
        return;
      }
      if (name.endsWith(".zip")) {
        const { default: JSZip } = await import("jszip");
        const zip = await JSZip.loadAsync(file);
        const entry = Object.values(zip.files).find(
          (f) => !f.dir && f.name.toLowerCase().endsWith(".txt"),
        );
        if (!entry) {
          setError("No chat text file found inside that .zip.");
          return;
        }
        doParse(await entry.async("string"));
        return;
      }
      setError(
        "Right now Group Read takes pasted text, a .txt chat export, or a .zip containing one. Images and other exports aren't supported yet.",
      );
    } catch {
      setError("We couldn't open that file.");
    }
  };

  const submit = async () => {
    if (!parsed) return;
    if (included.length < MIN_PARTICIPANTS || included.length > MAX_PARTICIPANTS) {
      setError(`Group Read needs between ${MIN_PARTICIPANTS} and ${MAX_PARTICIPANTS} people.`);
      return;
    }
    if (includedMessageCount < MIN_MESSAGES) {
      setError(`We need at least ${MIN_MESSAGES} messages from the people you kept.`);
      return;
    }
    setSubmitting(true);
    setError(null);

    const ids = new Set(included.map((p) => p.id));
    const body = {
      session_id: getSessionId(),
      category,
      participants: included.map((p) => ({ id: p.id, display_name: p.display_name })),
      messages: parsed.messages
        .filter((m) => m.participant_id && ids.has(m.participant_id))
        .map((m) => ({
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
      const message =
        (fnErr as { context?: { body?: string } })?.context?.body ?? "";
      let readable = "We couldn't start your group read. Please try again.";
      try {
        const parsedErr = JSON.parse(message) as { error?: string };
        if (parsedErr?.error) readable = parsedErr.error;
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
    navigate(`/group/${data.group_read_id}`);
  };

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
              accept=".txt,text/plain,.zip,application/zip,application/x-zip-compressed"
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
                <Upload className="h-4 w-4" /> Upload .txt or .zip export
              </button>
              <button
                type="button"
                onClick={() => setText(SAMPLE)}
                className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Use an example
              </button>
            </div>

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

        {step === "confirm" && parsed && (
          <section className="mt-8 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-[18px] font-medium">
                <Users className="h-4 w-4" /> We found {parsed.participants.length} people
              </h2>
              <p className="mt-1 text-[14px] text-muted-foreground">
                Merge duplicates, drop bots and system entries, and tell us which one is you
                (optional). {includedMessageCount} messages from {included.length} people will be
                read.
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
                        onClick={() =>
                          setMergeSource(mergeSource === p.id ? null : p.id)
                        }
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
            </div>

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
              {included.length} people · {includedMessageCount} messages · messages deleted after
              we read them
            </p>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default GroupRead;
