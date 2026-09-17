import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, Info } from "lucide-react";
import { Header } from "@/components/chemistry/Header";

const STEPS = [
  "Upload or paste the group chat",
  "Confirm who's in it",
  "See a short preview of the roast",
  "Unlock the full roast, or get it with Prime",
];

const GroupRoastStart = () => (
  <div className="min-h-screen bg-btln-paper text-foreground">
    <Helmet>
      <title>Group Roast — coming soon</title>
      <meta
        name="description"
        content="Group Roast takes a group chat on its own and roasts the cast. The engine behind it is still being built."
      />
      <link rel="canonical" href="https://betweenthelines.app/group-roast" />
      <meta name="robots" content="noindex" />
    </Helmet>
    <Header />
    <main className="mx-auto max-w-2xl px-5 pb-24 pt-4 sm:px-8">
      <h1 className="text-[33px] font-medium leading-[1.08] tracking-[-1.15px] sm:text-[40px]">
        Our group
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        Who keeps this chat together—and who brings the chaos? Group Roast takes a group
        chat on its own: no earlier report needed, no unlock needed first.
      </p>

      <div className="mt-6 rounded-[20px] border border-btln-line bg-btln-peach/50 p-[18px]">
        <p className="flex items-start gap-2 text-[15px] font-medium">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> Not ready yet
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          The part that reads a group chat on its own and writes the roast is still being
          built, so uploads are switched off here rather than sending you somewhere that
          asks for an earlier report. Nothing on this page charges anything.
        </p>
      </div>

      <h2 className="mt-8 text-[18px] font-medium tracking-tight">How it will work</h2>
      <ol className="mt-3 flex flex-col gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className="flex min-h-[56px] items-center gap-3 rounded-[20px] border border-btln-line bg-card p-[18px] text-[15px]"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-btln-mint text-[13px] font-medium text-btln-forest">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      <h2 className="mt-8 text-[18px] font-medium tracking-tight">You can do these today</h2>
      <div className="mt-3 flex flex-col gap-3">
        <Link
          to="/group"
          className="flex min-h-[72px] items-center justify-between gap-3 rounded-[20px] border border-btln-line bg-card p-[18px] hover:bg-muted/40"
        >
          <span>
            <span className="block text-[15px] font-medium">Group Read</span>
            <span className="mt-1 block text-[14px] text-muted-foreground">
              The serious read of the same group chat. Works now.
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
        <Link
          to="/roast"
          className="flex min-h-[72px] items-center justify-between gap-3 rounded-[20px] border border-btln-line bg-card p-[18px] hover:bg-muted/40"
        >
          <span>
            <span className="block text-[15px] font-medium">Roast Us (two people)</span>
            <span className="mt-1 block text-[14px] text-muted-foreground">
              The playful version for a two-person chat. Works now.
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>
    </main>
  </div>
);

export default GroupRoastStart;
