import { ArrowRight } from "lucide-react";
import { logEvent } from "@/lib/session";

const scrollToInput = () => {
  logEvent("cta_clicked", { location: "final" });
  document.getElementById("input-section")?.scrollIntoView({ behavior: "smooth" });
};

export const FinalCta = () => {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-[28px] font-medium tracking-tight sm:text-[40px]">Ready to see yours?</h2>
        <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground sm:text-[18px]">
          It takes 90 seconds. No account, no payment, no catch — we&apos;re testing the product and want
          your honest feedback.
        </p>
        <button
          onClick={scrollToInput}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90"
        >
          Start my analysis <ArrowRight className="h-4 w-4" />
        </button>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {["🔒 Private by default", "⚡ Results in 90s", "💬 Optional feedback at the end"].map((p) => (
            <span
              key={p}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] text-muted-foreground"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};