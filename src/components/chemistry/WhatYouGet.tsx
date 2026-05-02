const Bar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div>
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

const horsemen = [
  { name: "Criticism", status: "Clear", tone: "green" as const },
  { name: "Contempt", status: "Clear", tone: "green" as const },
  { name: "Defensive", status: "Clear", tone: "green" as const },
  { name: "Stonewall", status: "Watch", tone: "amber" as const },
];

const prompts = [
  "Jordan — when you say 'idk' on emotional questions, what's actually going on for you in that moment?",
  "Alex — what would it look like for Jordan to support you that doesn't require them to find the right words first?",
  "What do Sunday evenings actually feel like for each of you?",
];

export const WhatYouGet = () => {
  return (
    <section className="bg-section-soft px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm text-muted-foreground">What you&apos;ll get</p>
        <h2 className="mt-3 text-[28px] font-medium tracking-tight sm:text-[36px]">Your full scorecard.</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Sample report · Alex &amp; Jordan · 4 months together
        </p>

        <div className="mt-10 space-y-6">
          {/* 1 — Communication diagnostic */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              1 · Communication diagnostic
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { label: "Avg reply time", value: "Alex 12 min · Jordan 47 min" },
                { label: "Conversations initiated", value: "Alex 68% · Jordan 32%" },
                { label: "Message length ratio", value: "Alex writes 2.3x longer" },
                { label: "Questions asked", value: "Alex 41 · Jordan 12" },
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-muted p-4">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
                  <div className="mt-1 text-[15px] font-medium">{m.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-pastel-purple-bg p-5 text-pastel-purple-fg-strong">
              <div className="text-[11px] font-semibold uppercase tracking-wide">Key observation</div>
              <p className="mt-1.5 text-[14px] leading-relaxed">
                Jordan&apos;s reply time stretches from 12 min to 84 min when topics shift to emotions or
                future plans. The pattern is consistent across all 11 emotional bids in the past month.
              </p>
            </div>
          </div>

          {/* 2 — Attachment styles */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              2 · Attachment styles
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-medium">Alex</span>
                  <span className="rounded-full bg-pastel-green-bg px-2.5 py-0.5 text-[11px] font-medium text-pastel-green-fg-strong">
                    Secure
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <Bar label="Secure" value={78} color="bg-pastel-green-fg-strong" />
                  <Bar label="Anxious" value={35} color="bg-pastel-purple-fg" />
                  <Bar label="Avoidant" value={18} color="bg-pastel-amber-fg-strong" />
                </div>
              </div>
              <div className="rounded-xl border border-border p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-medium">Jordan</span>
                  <span className="rounded-full bg-pastel-amber-bg px-2.5 py-0.5 text-[11px] font-medium text-pastel-amber-fg-strong">
                    Avoidant
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <Bar label="Avoidant" value={72} color="bg-pastel-amber-fg-strong" />
                  <Bar label="Secure" value={48} color="bg-pastel-green-fg-strong" />
                  <Bar label="Anxious" value={22} color="bg-pastel-purple-fg" />
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-muted p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Quoted evidence — Jordan
              </div>
              <div className="mt-2 space-y-1.5 text-[14px] italic text-foreground">
                <p>&ldquo;yeah idk lol, can we talk about this later&rdquo;</p>
                <p>&ldquo;i&apos;m not really a feelings guy you know that&rdquo;</p>
              </div>
            </div>

            <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
              Secure × avoidant pairings can stabilize over time — Alex&apos;s consistency is doing the heavy
              lifting. The risk is asymmetric burnout if Jordan doesn&apos;t develop language for emotional
              topics.
            </p>
          </div>

          {/* 3 — Four horsemen */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              3 · The four horsemen
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {horsemen.map((h) => (
                <div key={h.name} className="rounded-xl border border-border p-4">
                  <div className="text-[13px] font-medium">{h.name}</div>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      h.tone === "green"
                        ? "bg-pastel-green-bg text-pastel-green-fg-strong"
                        : "bg-pastel-amber-bg text-pastel-amber-fg-strong"
                    }`}
                  >
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 4 — Hidden pattern */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              4 · The hidden pattern
            </div>
            <div className="mt-5 rounded-xl bg-pastel-purple-bg p-5 text-pastel-purple-fg-strong">
              <h4 className="text-[16px] font-semibold tracking-tight">
                You both go quiet on Sunday evenings.
              </h4>
              <p className="mt-2 text-[14px] leading-relaxed">
                Across 14 of the past 16 Sundays, message volume drops to nearly zero between 6pm and 11pm.
                This may be Sunday-night anxiety about the week ahead leaking into the relationship. Worth
                naming — it&apos;s not personal, but it reads that way to whoever&apos;s noticing.
              </p>
            </div>
          </div>

          {/* 5 — Personalized prompts */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              5 · Personalized prompts for this week
            </div>
            <div className="mt-5 space-y-3">
              {prompts.map((q) => (
                <div
                  key={q}
                  className="rounded-xl border-l-2 border-l-pastel-green-fg-strong bg-muted px-5 py-4 text-[14px] italic leading-relaxed text-foreground"
                >
                  &ldquo;{q}&rdquo;
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};