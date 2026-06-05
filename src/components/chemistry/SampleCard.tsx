import { Heart } from "lucide-react";

export const SampleCard = () => {
  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[20px] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5 fill-foreground text-foreground" strokeWidth={0} />
          <span className="text-[13px] font-medium tracking-tight">betweenthelines.app</span>
        </div>
        <span className="text-[11px] text-muted-foreground">142 messages analyzed</span>
      </div>

      {/* Score */}
      <div className="mt-6 flex flex-col items-center text-center">
        <span className="text-xs text-muted-foreground">Maya &amp; Daniel</span>
        <span className="mt-1 text-[80px] font-medium leading-none tracking-tight">96</span>
        <span className="mt-3 inline-flex items-center rounded-full bg-pastel-pink-bg px-3 py-1 text-xs font-medium text-pastel-pink-fg-strong">
          Power couple
        </span>
      </div>

      {/* Vibe quote */}
      <p className="mt-5 text-center text-[13px] italic leading-relaxed text-muted-foreground">
        &ldquo;You finish each other&apos;s sentences and still flirt like it&apos;s the first week.&rdquo;
      </p>

      {/* Score cards */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          { label: "Communication", value: 95 },
          { label: "Safety", value: 97 },
          { label: "Spark", value: 94 },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-muted px-2 py-2.5 text-center">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-0.5 text-base font-medium">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Flag callouts */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-pastel-green-bg p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-pastel-green-fg">Green flag</div>
          <p className="mt-1 text-[11px] leading-snug text-pastel-green-fg">
            Daily &ldquo;thinking of you&rdquo; texts — unprompted, on both sides.
          </p>
        </div>
        <div className="rounded-lg bg-pastel-pink-bg p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-pastel-pink-fg">Spark</div>
          <p className="mt-1 text-[11px] leading-snug text-pastel-pink-fg">
            Inside jokes and flirty callbacks woven through every conversation.
          </p>
        </div>
      </div>

      {/* Separator + attachment styles */}
      <div className="mt-5 border-t border-border pt-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Attachment styles
        </div>
        <div className="mt-1 text-[13px]">
          Maya secure <span className="text-muted-foreground">·</span> Daniel secure
        </div>
      </div>
    </div>
  );
};