import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { logEvent } from "@/lib/session";

const scrollToInput = () => {
  logEvent("cta_clicked", { location: "returning_hero" });
  document.getElementById("input-section")?.scrollIntoView({ behavior: "smooth" });
};

export const ReturningHero = () => {
  return (
    <section className="mx-auto max-w-3xl px-5 pb-6 pt-10 text-center sm:px-8 sm:pb-8 sm:pt-14">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Welcome back
      </p>
      <h1 className="mt-3 text-[32px] font-medium leading-[1.1] tracking-tight sm:text-[40px]">
        Read another conversation
      </h1>
      <p className="mx-auto mt-4 max-w-[620px] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]">
        Paste a new chat or thread and we'll show you what's really being said — your
        communication patterns, the dynamics underneath, and what to do about them.
      </p>
      <div className="mt-6 flex justify-center">
        <button
          onClick={scrollToInput}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90"
        >
          Read between the lines <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-5">
        <Link
          to="/account"
          className="text-[14px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Or revisit your past reads →
        </Link>
      </div>
    </section>
  );
};