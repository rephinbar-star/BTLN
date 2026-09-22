import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyFeedback, resetCoachingPersonalization } from "@/lib/feedback/api";

type Context = {
  available?: boolean;
  liked_reasons?: string[];
  disliked_reasons?: string[];
  notes?: string[];
  count?: number;
};

/**
 * Lets a signed-in person see, reset or delete the feedback that personalises their
 * future reads. Always available — it is not gated behind a membership.
 */
export const CoachingPersonalization = () => {
  const [context, setContext] = useState<Context | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_coaching_feedback_context");
    setContext((data ?? null) as Context | null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true);
    setStatus(null);
    const result = await fn();
    setBusy(false);
    setStatus(result.ok ? done : (result.error ?? "That did not work. Please try again."));
    await load();
  };

  const liked = context?.liked_reasons ?? [];
  const disliked = context?.disliked_reasons ?? [];
  const notes = context?.notes ?? [];
  const hasAny = liked.length + disliked.length + notes.length > 0;

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-8">
      <h2 className="text-[18px] font-medium tracking-tight">How your reads are personalised</h2>
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        When you rate a read, we keep a short private summary of what you found helpful and use it
        to adjust the style of your future reads. It never changes what the evidence says, and it
        does not retrain the model.
      </p>

      {hasAny ? (
        <div className="rounded-xl border border-border p-4 text-[14px]">
          {liked.length > 0 && (
            <p>
              <span className="font-medium">You marked as helpful:</span> {liked.join(", ")}
            </p>
          )}
          {disliked.length > 0 && (
            <p className="mt-2">
              <span className="font-medium">You flagged:</span> {disliked.join(", ")}
            </p>
          )}
          {notes.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">Notes you wrote:</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[14px] text-muted-foreground">
          Nothing is being used to personalise your reads yet.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="min-h-11 rounded-full"
          disabled={busy}
          onClick={() =>
            void run(resetCoachingPersonalization, "Personalisation reset. Ratings are kept.")
          }
        >
          Reset personalisation
        </Button>
        <Button
          variant="outline"
          className="min-h-11 rounded-full"
          disabled={busy}
          onClick={() => void run(deleteMyFeedback, "All of your ratings and notes were deleted.")}
        >
          Delete all my ratings
        </Button>
      </div>
      {status && <p className="text-[13px] text-muted-foreground">{status}</p>}
    </section>
  );
};
