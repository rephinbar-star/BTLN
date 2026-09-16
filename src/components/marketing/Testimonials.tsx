import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Testimonial {
  id: string;
  quote: string;
  attribution: string;
}

/**
 * Renders only genuine reader feedback that the submitter consented to publish
 * AND an admin approved. When nothing is approved it renders nothing at all —
 * there is no placeholder, sample or seeded content, by design.
 */
export function Testimonials() {
  const [items, setItems] = useState<Testimonial[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc("list_approved_testimonials");
      if (!active || error || !Array.isArray(data)) return;
      setItems(data as Testimonial[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="testimonials-heading" className="border-t border-border px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 id="testimonials-heading" className="text-[26px] font-medium sm:text-[32px]">
          What readers said about their own report
        </h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Published with each person&rsquo;s explicit permission. Names are whatever they chose to share.
        </p>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2">
          {items.map((t) => (
            <li key={t.id} className="rounded-xl border border-border bg-card p-6">
              <blockquote className="text-[16px] leading-relaxed">&ldquo;{t.quote}&rdquo;</blockquote>
              <p className="mt-4 text-[14px] text-muted-foreground">{t.attribution}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
