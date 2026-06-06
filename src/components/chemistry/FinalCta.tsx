import { ArrowRight } from "lucide-react";
import { logEvent } from "@/lib/session";
import { InviteFriendsButton } from "./InviteFriendsButton";

const startNewAnalysis = () => {
  logEvent("cta_clicked", { location: "final" });
  try {
    // Force a fresh session_id so the new analysis is independent of any
    // prior one, regardless of whether the user is anonymous or logged in.
    window.localStorage.removeItem("chemistry_session_id");
  } catch {
    // ignore storage errors
  }
  // Hard-navigate to the input section so the input form remounts with
  // clean state.
  window.location.assign("/#input-section");
};

export const FinalCta = () => {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <button
          onClick={startNewAnalysis}
          className="inline-flex w-full max-w-[280px] items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90"
        >
          Start a new analysis <ArrowRight className="h-4 w-4" />
        </button>
        <InviteFriendsButton className="mt-4" />
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