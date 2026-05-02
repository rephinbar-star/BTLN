import { ArrowRight } from "lucide-react";
import { SampleCard } from "./SampleCard";

const scrollToInput = () => {
  document.getElementById("input-section")?.scrollIntoView({ behavior: "smooth" });
};

export const Hero = () => {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-8 pt-10 sm:px-8 sm:pb-10 sm:pt-14 lg:pt-16">
      <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
        <div className="order-1">
          <p className="text-sm text-muted-foreground">AI relationship analysis</p>
          <h1 className="mt-4 text-[32px] font-medium leading-[1.05] tracking-tight sm:text-[40px] lg:text-[52px]">
            See what your texts actually say about your relationship.
          </h1>
          <p className="mt-5 max-w-[560px] text-[18px] leading-relaxed text-muted-foreground sm:text-[20px]">
            Drop in a few screenshots or paste your texts. Get a detailed report on your communication style,
            attachment patterns, and the dynamics hiding in plain sight.
          </p>
          <div className="mt-7">
            <button
              onClick={scrollToInput}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90"
            >
              Try it free <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 flex flex-col gap-1 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
            <span>No account required</span>
            <span className="hidden sm:inline">·</span>
            <span>Nothing stored. Analyzed in seconds, then discarded.</span>
            <span className="hidden sm:inline">·</span>
            <span>Results in 90 seconds</span>
          </div>
        </div>
        <div className="order-2">
          <SampleCard />
        </div>
      </div>
    </section>
  );
};