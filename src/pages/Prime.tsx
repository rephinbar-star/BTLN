import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Info } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { useMembership } from "@/hooks/useMembership";
import { SeeExample } from "@/components/examples/ExampleExperience";

const INCLUDED = [
  "Quick Take, Deep Read and Group Read in one place",
  "Group Roast, including the standalone version as it lands",
  "Relationship Wrapped recaps for the periods you import",
  "Relationship360: your private, opt-in view across your own reads",
];

const TIMELINE = [
  { when: "Month 1", what: "Your first reads land, and the pattern list starts." },
  { when: "Month 2", what: "A second conversation gives something to compare against." },
  { when: "Month 3", what: "A review points out what's repeating and what changed." },
];

const Prime = () => {
  const [params] = useSearchParams();
  const raw = params.get("return_to");
  // Only allow same-site returns.
  const returnTo = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
  const { isMember, loading } = useMembership();

  return (
    <div className="min-h-screen bg-btln-paper text-foreground">
      <Helmet>
        <title>BTLN Prime — understand who you are in your relationships</title>
        <meta
          name="description"
          content="Prime is $19.99 a month: every BetweenTheLines feature plus your private Relationship360 across your own conversations."
        />
        <link rel="canonical" href="https://betweenthelines.app/prime" />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-2xl px-5 pb-24 pt-4 sm:px-8">
        <h1 className="text-[33px] font-medium leading-[1.08] tracking-[-1.15px] sm:text-[42px]">
          Understand who you are in your relationships—and get insights and coaching for self improvement.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
          See the patterns in how you communicate, respond, and connect—with practical coaching
          that develops as you add more conversations.
        </p>

        <SeeExample kind="journey" />

        <div className="mt-7 rounded-[20px] border-2 border-btln-forest bg-btln-mint/50 p-[18px]">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[17px] font-medium">BTLN Prime</span>
            <span className="text-[17px] font-medium">$19.99/month</span>
          </div>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Renews monthly at $19.99 until you cancel. Cancel any time from your account —
            you keep access until the end of the period you've paid for.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {INCLUDED.map((i) => (
              <li key={i} className="flex items-start gap-2 text-[15px]">
                <Check className="mt-1 h-4 w-4 shrink-0 text-btln-forest" /> {i}
              </li>
            ))}
          </ul>
          {!loading && isMember ? (
            <p className="mt-5 rounded-2xl bg-background px-4 py-3 text-[14px]">
              You're already on a paid plan. Prime will be shown as an option in your
              account when it opens — you won't be charged twice or asked to buy it here.
            </p>
          ) : (
            <>
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-foreground px-6 text-[15px] font-medium text-background opacity-40"
              >
                Prime isn't open yet
              </button>
              <p className="mt-3 flex items-start gap-2 text-[13px] text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Prime is in testing. Billing for it isn't switched on, so nothing can be
                charged from this page yet. Today's plans and single reports are unchanged
                and still work on the pricing page.
              </p>
            </>
          )}
        </div>

        <h2 className="mt-10 text-[20px] font-medium tracking-tight">
          How it builds up <span className="text-muted-foreground">(sample)</span>
        </h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          An illustration of the shape, not real data from anyone's account.
        </p>
        <ol className="mt-4 flex flex-col gap-3">
          {TIMELINE.map((t) => (
            <li key={t.when} className="rounded-[20px] border border-btln-line bg-card p-[18px]">
              <span className="text-[13px] font-medium text-btln-forest">{t.when}</span>
              <p className="mt-1 text-[15px]">{t.what}</p>
            </li>
          ))}
        </ol>

        <h2 className="mt-10 text-[20px] font-medium tracking-tight">Your privacy</h2>
        <ul className="mt-3 flex flex-col gap-2 text-[15px] text-muted-foreground">
          <li>Relationship360 is off until you switch it on, and private to your account.</li>
          <li>You choose which of your own reads are included, one at a time.</li>
          <li>You can correct, exclude or delete anything, including all of it.</li>
          <li>There is no public Relationship360 link, and raw chats aren't kept in your browser.</li>
        </ul>


        <p className="mt-8 text-[14px] text-muted-foreground">
          Want today's options instead?{" "}
          <Link to="/pricing" className="underline underline-offset-4 hover:text-foreground">
            See plans and pricing
          </Link>
          .
        </p>
      </main>
    </div>
  );
};

export default Prime;
