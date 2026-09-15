import { forwardRef } from "react";

type Props = {
  headline: string;
  observations: { label: string; text: string }[];
  closing: string;
};

/**
 * 9:16 export card for a roast. Never renders raw chat text — only the
 * already-redacted lines the owner chose to release.
 */
export const RoastStoryCard = forwardRef<HTMLDivElement, Props>(
  ({ headline, observations, closing }, ref) => (
    <div
      ref={ref}
      style={{ width: 1080, height: 1920 }}
      className="flex flex-col justify-between bg-[hsl(var(--card))] p-20 text-foreground"
    >
      <div>
        <p className="text-[34px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Roast Us
        </p>
        <h1 className="mt-10 text-[86px] font-medium leading-[1.05] tracking-tight">{headline}</h1>
      </div>

      <ul className="space-y-10">
        {observations.slice(0, 4).map((o, i) => (
          <li key={i} className="rounded-[36px] border-[3px] border-border bg-background p-12">
            <p className="text-[38px] font-semibold">{o.label}</p>
            <p className="mt-4 text-[42px] leading-snug">{o.text}</p>
          </li>
        ))}
      </ul>

      <div>
        <p className="text-[44px] leading-snug text-muted-foreground">{closing}</p>
        <p className="mt-14 text-[52px] font-medium">What would your chat say?</p>
        <p className="mt-3 text-[40px] text-muted-foreground">betweenthelines.app</p>
      </div>
    </div>
  ),
);
RoastStoryCard.displayName = "RoastStoryCard";
