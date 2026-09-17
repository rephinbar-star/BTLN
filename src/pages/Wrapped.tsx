import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PublicPage } from "@/components/marketing/PublicPage";
import { readChatFile, UnsupportedFileError } from "@/lib/ingest/file";
import { parseTranscript, type IngestResult } from "@/lib/ingest/parse";
import {
  availablePeriods,
  computeWrappedStats,
  pseudonymMap,
  type WrappedPeriod,
} from "@/lib/wrapped/stats";
import { WrappedCard, type WrappedCardVariant } from "@/components/wrapped/WrappedCard";
import { SeeExample } from "@/components/examples/ExampleExperience";

const SIZE_LABEL: Record<WrappedCardVariant, string> = {
  story: "Story 1080 × 1920",
  square: "Square 1080 × 1080",
};

export default function Wrapped() {
  const [parsed, setParsed] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [periodIndex, setPeriodIndex] = useState(0);
  const [pseudonyms, setPseudonyms] = useState(true);
  const storyRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLDivElement>(null);

  const periods = useMemo<WrappedPeriod[]>(
    () => (parsed ? availablePeriods(parsed.messages) : []),
    [parsed],
  );
  const period = periods[periodIndex] ?? null;

  const stats = useMemo(() => {
    if (!parsed || !period) return null;
    const inRange = parsed.messages.filter(
      (m) => m.ts && m.ts.slice(0, 10) >= period.from && m.ts.slice(0, 10) <= period.to,
    );
    if (!inRange.length) return null;
    return computeWrappedStats(inRange, parsed.participants, period);
  }, [parsed, period]);

  const names = useMemo(() => {
    if (!stats) return {};
    if (pseudonyms) return pseudonymMap(stats);
    return Object.fromEntries(stats.participants.map((p) => [p.id, p.name]));
  }, [stats, pseudonyms]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const read = await readChatFile(file);
      if (read.kind === "choose") {
        setError(
          "That archive holds more than one chat. Export a single conversation and try again.",
        );
        return;
      }
      const result = parseTranscript(read.text);
      if (!result.messages.some((m) => m.ts)) {
        setError(
          "We couldn't read any dates from that export, so a period recap isn't possible for it.",
        );
        return;
      }
      setParsed(result);
      setPeriodIndex(0);
    } catch (e) {
      setError(
        e instanceof UnsupportedFileError
          ? e.message
          : "We couldn't read that file. WhatsApp and iMessage exports as .txt, .csv or .zip work best.",
      );
    } finally {
      setBusy(false);
    }
  };

  const download = async (variant: WrappedCardVariant) => {
    const node = (variant === "story" ? storyRef : squareRef).current;
    if (!node || !stats) return;
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(node, {
      width: 1080,
      height: variant === "story" ? 1920 : 1080,
      pixelRatio: 1,
      cacheBust: true,
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `btln-wrapped-${period?.label.replace(/\s+/g, "-").toLowerCase()}-${variant}.png`;
    a.click();
  };

  return (
    <PublicPage
      title="Relationship Wrapped: Your Chat Year in Numbers | BetweenTheLines™"
      description="Import a WhatsApp or iMessage export and get a counted recap of a month, quarter or year: messages, who starts conversations, reply gaps, busiest days and most-used emojis."
      path="/wrapped"
    >
      <p className="text-sm text-muted-foreground">Relationship Wrapped</p>
      <h1 className="mt-3 text-[36px] font-medium leading-tight sm:text-[48px]">
        Your conversation, counted
      </h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
        Pick a chat export and a period. Every figure below is counted from the messages you
        imported for that period — nothing is estimated, predicted or written by a model. Your file
        stays in this browser; we don&apos;t save the conversation.
      </p>
      <SeeExample kind="wrapped" />

      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <Label htmlFor="wrapped-file" className="text-[15px] font-medium">
          Chat export (.txt, .csv or .zip)
        </Label>
        <input
          id="wrapped-file"
          type="file"
          accept=".txt,.csv,.zip,text/plain,text/csv,application/zip"
          className="mt-3 block w-full rounded-lg border border-input bg-background p-2.5 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-1.5 file:text-sm"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {busy && <p className="mt-3 text-sm text-muted-foreground">Reading your export…</p>}
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Need one?{" "}
          <Link to="/guides/whatsapp" className="underline">
            How to export a WhatsApp chat
          </Link>
        </p>
      </div>

      {parsed && periods.length > 0 && (
        <div className="mt-6">
          <Label htmlFor="wrapped-period" className="text-[15px] font-medium">
            Period
          </Label>
          <select
            id="wrapped-period"
            className="mt-2 w-full max-w-sm rounded-lg border border-input bg-background p-2.5 text-sm"
            value={periodIndex}
            onChange={(e) => setPeriodIndex(Number(e.target.value))}
          >
            {periods.map((p, i) => (
              <option key={`${p.kind}-${p.from}`} value={i}>
                {p.label}
              </option>
            ))}
          </select>
          <div className="mt-4 flex items-center gap-3">
            <Switch id="wrapped-pseudonyms" checked={pseudonyms} onCheckedChange={setPseudonyms} />
            <Label htmlFor="wrapped-pseudonyms" className="text-sm">
              Hide real names (Person A, Person B)
            </Label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Quotes from your messages are never included in a recap card.
          </p>
        </div>
      )}

      {parsed && period && !stats && (
        <p className="mt-6 text-sm text-muted-foreground">
          No messages fall inside {period.label}. Pick another period.
        </p>
      )}

      {stats && (
        <>
          <section className="mt-10" aria-label="Recap preview">
            <h2 className="text-xl font-medium">{stats.period.label}</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Messages", stats.totals.messages.toLocaleString()],
                ["Days with messages", stats.totals.activeDays.toLocaleString()],
                ["Conversations started", stats.initiation.sessions.toLocaleString()],
                ["Words", stats.totals.words.toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border p-4">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-2xl font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 font-medium">Person</th>
                    <th scope="col" className="py-2 font-medium">Messages</th>
                    <th scope="col" className="py-2 font-medium">Share</th>
                    <th scope="col" className="py-2 font-medium">Starts conversations</th>
                    <th scope="col" className="py-2 font-medium">Typical reply gap</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  {stats.participants.map((p) => {
                    const init = stats.initiation.byParticipant.find((i) => i.id === p.id);
                    const rep = stats.replies.find((r) => r.id === p.id);
                    return (
                      <tr key={p.id} className="border-b border-border">
                        <th scope="row" className="py-2 font-normal text-foreground">
                          {names[p.id] ?? p.name}
                        </th>
                        <td className="py-2">{p.messages.toLocaleString()}</td>
                        <td className="py-2">{Math.round(p.share * 100)}%</td>
                        <td className="py-2">{init ? `${Math.round(init.share * 100)}%` : "—"}</td>
                        <td className="py-2">
                          {rep?.medianReplyMinutes != null
                            ? `${Math.round(rep.medianReplyMinutes)} min`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="mt-6 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {stats.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
              {parsed?.timezone_assumed && (
                <li>
                  The export carried no timezone, so times are read exactly as written in the file.
                </li>
              )}
              {parsed?.ambiguous_dates && (
                <li>
                  Some dates could be read two ways; we used{" "}
                  {parsed.day_first ? "day/month" : "month/day"} consistently.
                </li>
              )}
            </ul>
          </section>

          <section className="mt-10" aria-label="Download your cards">
            <h2 className="text-xl font-medium">Download</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cards are generated in your browser at full size. No share link is created.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {(["story", "square"] as WrappedCardVariant[]).map((v) => (
                <Button key={v} className="rounded-full" onClick={() => void download(v)}>
                  {SIZE_LABEL[v]}
                </Button>
              ))}
            </div>
          </section>

          {/* Off-screen full-size render targets — exact export pixels, never clipped. */}
          <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
            <WrappedCard ref={storyRef} stats={stats} names={names} variant="story" />
            <WrappedCard ref={squareRef} stats={stats} names={names} variant="square" />
          </div>
        </>
      )}
    </PublicPage>
  );
}
