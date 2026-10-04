import { ArrowRight, ChevronDown, Compass, Loader2, MessagesSquare, NotebookPen, Repeat2, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AskMoment, AskResult } from "@/lib/relationship360/ask";
import { SUGGESTED_QUESTIONS } from "@/lib/relationship360/ask";
import relationshipArt from "@/assets/home-modes/relationship360.webp.asset.json";

export type QuestionSource = { id: string; label: string; detail: string };
export type QuestionNote = { id: string; label: string; excerpt: string };

const ICONS = [Repeat2, TrendingUp, Compass];

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) : "Date not recorded");

function Moment({ m }: { m: AskMoment }) {
  const Icon = m.kind === "note" ? NotebookPen : MessagesSquare;
  return (
    <details className="group border-t border-prime-line">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md [&::-webkit-details-marker]:hidden">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px]">{m.label}</span>
          <span className="block font-mono text-[10px] text-muted-foreground">{fmt(m.date)} · {m.actor}</span>
        </span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-3 pl-7 text-[13px] leading-relaxed">
        {m.kind === "note" ? (
          <>
            <p>{m.text}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Your private note — self-reported, not conversation evidence.</p>
          </>
        ) : (
          <>
            {m.quote && <blockquote className="font-quote text-[15px] italic leading-[22px]">“{m.quote}”</blockquote>}
            <p className={m.quote ? "mt-1 text-muted-foreground" : ""}>{m.text}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {m.quote ? "Excerpt matches the evidence stored with this read. " : ""}Summary is a paraphrase from a stored observation; raw messages are not kept.
              {m.date_kind === "undated" ? " No verified date." : ""}
            </p>
          </>
        )}
      </div>
    </details>
  );
}

export function QuestionsView(props: {
  banner?: string;
  question: string;
  onQuestion: (q: string) => void;
  onAsk: () => void;
  asking: boolean;
  canAsk: boolean;
  sources: QuestionSource[];
  selected: string[];
  onToggleSource?: (id: string) => void;
  notes?: QuestionNote[];
  selectedNotes?: string[];
  onToggleNote?: (id: string) => void;
  sourceSummary: string;
  result: AskResult | null;
  askedQuestion: string;
  error: string | null;
  emptyAnswerText?: string;
}) {
  const { result } = props;
  return (
    <>
      {props.banner && <p className="border-b border-prime-line bg-prime-panel px-4 py-2 text-center font-mono text-[11px] text-muted-foreground">{props.banner}</p>}
      <main className="prime-ambient mx-auto max-w-[1000px] px-[15px] pb-8 pt-6 md:px-[30px] md:pt-9">
        <section className="grid grid-cols-[minmax(0,1fr)_88px] items-start gap-3 md:grid-cols-[minmax(0,1fr)_154px] md:mb-7">
          <div className="min-w-0">
            <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-prism-lavender">Relationship360</p>
            <h1 className="font-display text-[26px] font-bold leading-[1.12] md:text-[36px]">Ask about your patterns.</h1>
            <p className="mt-3 text-[14px] leading-[1.6] text-muted-foreground">Find patterns in your reads and private notes.</p>
          </div>
          <img src={relationshipArt.url} alt="" aria-hidden="true" width={154} height={154} className="h-auto w-[88px] rounded-[14px] object-cover md:w-[154px]" />
        </section>

        <div className="mt-5 grid gap-4 md:mt-0 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] md:items-start md:gap-5">
          <form
            className="min-w-0 rounded-[17px] border border-prime-line bg-prime-panel p-[17px] md:p-5"
            onSubmit={(e) => { e.preventDefault(); if (props.canAsk && !props.asking) props.onAsk(); }}
          >
            <label htmlFor="r360-question" className="block text-[14px] font-semibold">Your question</label>
            <textarea
              id="r360-question"
              value={props.question}
              onChange={(e) => props.onQuestion(e.target.value)}
              maxLength={300}
              rows={4}
              className="mt-3 w-full resize-y rounded-[12px] border border-input bg-background p-4 text-[16px] leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mt-3 space-y-2" role="group" aria-label="Suggested questions">
              {SUGGESTED_QUESTIONS.map((q, i) => {
                const Icon = ICONS[i];
                const active = props.question.trim() === q;
                return (
                  <button
                    key={q}
                    type="button"
                    aria-pressed={active}
                    onClick={() => props.onQuestion(q)}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-[12px] border px-3 text-left text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-prime-action bg-prime-action/10" : "border-prime-line bg-background/40 hover:bg-background/70"}`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" /> {q}
                  </button>
                );
              })}
            </div>
            <Button type="submit" disabled={!props.canAsk || props.asking} className="mt-5 min-h-12 w-full bg-prime-action text-[15px] font-bold text-prime-action-foreground hover:bg-prime-action/90">
              {props.asking ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Asking…</> : <>Ask <ArrowRight aria-hidden="true" className="h-4 w-4" /></>}
            </Button>
            <details className="group mt-5 border-t border-prime-line pt-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md text-[13px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {props.sourceSummary}
                <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <fieldset className="mt-2 space-y-1">
                <legend className="mb-1 text-[12px] text-muted-foreground">Only these included reads are used for this question. Changing this does not change your profile.</legend>
                {props.sources.map((s) => (
                  <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 text-[13px]">
                    <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={props.selected.includes(s.id)} disabled={!props.onToggleSource} onChange={() => props.onToggleSource?.(s.id)} />
                    <span className="min-w-0"><span className="block">{s.label}</span><span className="block font-mono text-[10px] text-muted-foreground">{s.detail}</span></span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="mt-3 space-y-1 border-t border-prime-line pt-3">
                <legend className="mb-1 text-[12px] text-muted-foreground">Private notes (self-report, not conversation evidence). Only notes from the selected reads’ relationships can be used. Unticking does not change your profile.</legend>
                {(props.notes ?? []).length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">No private notes from the selected relationships.</p>
                ) : (props.notes ?? []).map((n) => (
                  <label key={n.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 text-[13px]">
                    <input type="checkbox" className="h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" checked={(props.selectedNotes ?? []).includes(n.id)} disabled={!props.onToggleNote} onChange={() => props.onToggleNote?.(n.id)} />
                    <span className="min-w-0"><span className="block">{n.label} · <span className="text-muted-foreground">self-report</span></span><span className="block truncate text-[12px] text-muted-foreground">{n.excerpt}</span></span>
                  </label>
                ))}
              </fieldset>
            </details>
          </form>

          <section aria-live="polite" aria-busy={props.asking} className="min-w-0 rounded-[17px] border border-prime-line bg-prime-panel p-[17px] md:p-5">
            {props.error ? (
              <p role="alert" className="text-[14px]">{props.error}</p>
            ) : props.asking ? (
              <p className="flex items-center gap-2 text-[14px] text-muted-foreground"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Reading your included sources…</p>
            ) : !result ? (
              <p className="text-[14px] text-muted-foreground">{props.emptyAnswerText ?? "Ask a question to see what your included reads suggest."}</p>
            ) : result.state === "no_evidence" ? (
              <p className="text-[14px]">The selected reads have no stored observations yet, so there is nothing to answer from. No answer was generated.</p>
            ) : result.state === "abstained" ? (
              <>
                <h2 className="font-display text-[20px] font-bold">{props.askedQuestion}</h2>
                <p className="mt-3 text-[15px] leading-relaxed">We can’t answer that honestly from what you included.</p>
                <p className="mt-2 text-[13px] text-muted-foreground">{result.reason}</p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-[13px] text-prism-lavender"><Sparkles aria-hidden="true" className="h-4 w-4" /> A pattern to explore</p>
                <h2 className="mt-3 font-display text-[22px] font-bold leading-tight md:text-[24px]">{result.title}</h2>
                <p className="mt-3 text-[15px] leading-[1.6]">{result.finding}</p>
                {result.note_context && <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{result.note_context} That is your reflection, not proof of what someone else meant.</p>}
                {result.next_step && (
                  <div className="mt-5 border-t border-prime-line pt-4">
                    <h3 className="text-[14px] font-semibold">Suggested next step</h3>
                    <p className="mt-2 text-[14px] leading-relaxed">{result.next_step}</p>
                  </div>
                )}
                <h3 className="mt-5 text-[14px] font-semibold">Supporting moments</h3>
                <div className="mt-2">{result.moments.map((m) => <Moment key={m.ref_id} m={m} />)}</div>
                <p className="mt-3 border-t border-prime-line pt-3 text-[12px] text-muted-foreground">{result.limitation}</p>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
