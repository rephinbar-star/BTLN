import { ArrowRight, Info } from "lucide-react";
import { useState } from "react";

type FormState = {
  conversation: string;
  stage: string;
  duration: string;
  goal: string;
  context: string;
  yourName: string;
  theirName: string;
};

const initialState: FormState = {
  conversation: "",
  stage: "",
  duration: "",
  goal: "",
  context: "",
  yourName: "",
  theirName: "",
};

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-0";

const labelClass = "text-[13px] font-medium text-foreground";

export const InputSection = () => {
  const [form, setForm] = useState<FormState>(initialState);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Backend wiring comes in a later prompt — log captured state for now.
    // eslint-disable-next-line no-console
    console.log("Chemistry form submitted:", form);
  };

  return (
    <section id="input-section" className="scroll-mt-24 px-5 pb-12 pt-8 sm:px-8 sm:pb-16 sm:pt-12">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-[28px] font-medium tracking-tight sm:text-[36px]">Try it now</h2>
        <p className="mt-3 text-[16px] text-muted-foreground sm:text-[18px]">
          Takes about 90 seconds. Free, no signup.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto mt-10 max-w-[720px] rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
      >
        {/* Info callout */}
        <div className="flex items-start gap-3 rounded-xl bg-pastel-blue-bg p-4 text-pastel-blue-fg">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="text-[13px] leading-relaxed">
            For best results: paste at least 50 messages. More is better — the analysis gets sharper with 100+
            messages spanning a few weeks. Below 30 messages, we can only give you a rough read.
          </p>
        </div>

        {/* Textarea */}
        <div className="mt-5">
          <textarea
            value={form.conversation}
            onChange={(e) => update("conversation", e.target.value)}
            placeholder="Paste a chunk of your conversation here. Both sides — at least 30 messages works best. We'll figure out who said what."
            className={`${fieldClass} h-[200px] resize-none leading-relaxed`}
          />
        </div>

        {/* Dropdowns */}
        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label className={labelClass}>Relationship stage</label>
            <select
              value={form.stage}
              onChange={(e) => update("stage", e.target.value)}
              className={`${fieldClass} mt-1.5 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[length:12px] bg-[position:right_1rem_center] bg-no-repeat pr-10`}
            >
              <option value="">Select…</option>
              <option>Dating, not exclusive</option>
              <option>Dating, exclusive</option>
              <option>Living together</option>
              <option>Engaged</option>
              <option>Married</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>How long have you been together</label>
            <select
              value={form.duration}
              onChange={(e) => update("duration", e.target.value)}
              className={`${fieldClass} mt-1.5 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[length:12px] bg-[position:right_1rem_center] bg-no-repeat pr-10`}
            >
              <option value="">Select…</option>
              <option>Under a month</option>
              <option>1–3 months</option>
              <option>3–6 months</option>
              <option>6 months – 1 year</option>
              <option>1–2 years</option>
              <option>2–5 years</option>
              <option>5+ years</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>What are you hoping to learn?</label>
            <select
              value={form.goal}
              onChange={(e) => update("goal", e.target.value)}
              className={`${fieldClass} mt-1.5 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[length:12px] bg-[position:right_1rem_center] bg-no-repeat pr-10`}
            >
              <option value="">Select…</option>
              <option>Just curious</option>
              <option>Trying to understand a pattern</option>
              <option>Red flag check</option>
              <option>Strengthening our communication</option>
              <option>Deciding whether to commit</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Anything we should know? (optional)</label>
            <input
              type="text"
              value={form.context}
              onChange={(e) => update("context", e.target.value)}
              placeholder="e.g., we're long-distance, just had a fight, etc."
              className={`${fieldClass} mt-1.5`}
            />
          </div>

          {/* Names */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Your name</label>
              <input
                type="text"
                value={form.yourName}
                onChange={(e) => update("yourName", e.target.value)}
                className={`${fieldClass} mt-1.5`}
              />
            </div>
            <div>
              <label className={labelClass}>Their name</label>
              <input
                type="text"
                value={form.theirName}
                onChange={(e) => update("theirName", e.target.value)}
                className={`${fieldClass} mt-1.5`}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-7 flex flex-col items-center">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90 sm:w-auto sm:min-w-[280px]"
          >
            Analyze my chemistry <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-4 max-w-md text-center text-[12px] leading-relaxed text-muted-foreground">
            By continuing, you agree your messages will be processed by AI and deleted immediately after.
          </p>
        </div>
      </form>
    </section>
  );
};