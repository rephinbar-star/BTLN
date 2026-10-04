import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, MessagesSquare, Route, ScanHeart } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import { Button } from "@/components/ui/button";
import relationshipArt from "@/assets/home-modes/relationship360.webp.asset.json";

const steps = [
  { icon: MessagesSquare, label: "Add a read" },
  { icon: ScanHeart, label: "Notice a pattern" },
  { icon: Route, label: "Choose a next step" },
];

const Prime = () => (
  <div className="prime-page min-h-screen bg-background text-foreground">
    <Helmet>
      <title>BTLN Prime — understand who you are in your relationships</title>
      <meta name="description" content="Prime is in development and cannot be purchased yet. Preview the proposed $19.99/month plan and private Relationship360." />
      <link rel="canonical" href="https://betweenthelines.app/prime" />
    </Helmet>
    <Header />
    <main className="prime-ambient mx-auto max-w-[1000px] px-[18px] pb-7 pt-6 md:px-[30px] md:pb-10 md:pt-9">
      <section className="grid grid-cols-[minmax(0,1fr)_95px] items-center gap-2 min-[361px]:grid-cols-[minmax(0,1fr)_130px] md:mb-7 md:grid-cols-[minmax(0,1fr)_300px] md:gap-7">
        <div className="min-w-0">
          <p className="mb-2 font-mono text-[11px] font-medium uppercase leading-[1.5] text-prism-lavender">Relationship360 · Prime preview</p>
          <h1 className="max-w-[15ch] font-display text-[26px] font-bold leading-[1.12] min-[361px]:text-[28px] md:text-[39px]">See how you connect.</h1>
          <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">
            Your conversations, connected.<br />Insights and coaching for you.
          </p>
          <Button asChild className="mt-5 min-h-12 max-w-full whitespace-normal bg-prime-action px-4 py-2 text-[14px] font-bold text-prime-action-foreground hover:bg-prime-action/90 md:px-[18px]">
            <Link to="/examples/relationship360">See a profile example <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </Button>
          <p className="mt-3 text-[12px] leading-5 text-muted-foreground">In development · Not available to buy yet.</p>
        </div>
        <img src={relationshipArt.url} alt="" aria-hidden="true" width={300} height={300} className="h-auto w-[95px] object-contain min-[361px]:w-[130px] md:w-[300px]" />
      </section>

      <div className="mt-6 grid gap-4 md:mt-0 md:grid-cols-2 md:items-start md:gap-[22px]">
        <section aria-labelledby="prime-picture" className="min-w-0 rounded-[17px] border border-prime-line bg-prime-panel p-[17px] md:p-5">
          <h2 id="prime-picture" className="font-display text-[20px] font-bold leading-[1.25] md:text-[22px]">A fuller picture of you.</h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">One read explores a conversation. Relationship360 connects what shows up across your reads.</p>
          <ol className="mt-[22px] grid grid-cols-3 gap-2.5 md:gap-3">
            {steps.map(({ icon: Icon, label }) => (
              <li key={label} className="min-w-0 rounded-[13px] bg-prime-step px-2 py-[15px] text-center">
                <Icon aria-hidden="true" className="mx-auto mb-2 h-[26px] w-[26px] text-prism-lavender" />
                <span className="block text-[12px] leading-[1.5]">{label}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="prime-choice" className="min-w-0 rounded-[17px] border border-prime-line bg-prime-panel p-[17px] md:p-5">
          <h2 id="prime-choice" className="font-display text-[20px] font-bold leading-[1.25] md:text-[22px]">Your reads. Your choice.</h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">Confirm which person is you.<br />Choose what contributes to your profile.</p>
          <details className="prime-disclosure mt-[18px] border-t border-prime-line">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-[13px] text-muted-foreground focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              How privacy and inclusion work <span aria-hidden="true" className="prime-disclosure-mark text-[20px] leading-none">+</span>
            </summary>
            <ul className="mb-3 ml-5 list-disc space-y-2 text-[13px] leading-[1.65] text-muted-foreground">
              <li>Relationship360 starts off. You choose when to turn it on.</li>
              <li>You can choose automatic inclusion of eligible saved reads after confirming your identity.</li>
              <li>You can correct, exclude, remove or delete sources.</li>
              <li>Your profile stays private to your account.</li>
            </ul>
          </details>
          <details className="prime-disclosure mt-3 border-t border-prime-line">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-[13px] text-muted-foreground focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              What is planned for Prime? <span aria-hidden="true" className="prime-disclosure-mark text-[20px] leading-none">+</span>
            </summary>
            <p className="mb-3 text-[13px] leading-[1.65] text-muted-foreground">All read modes, Interactive Mode and Relationship360. Proposed price: $19.99/month. The plan and price are previews, not an active subscription.</p>
          </details>
        </section>
      </div>
    </main>
    <Footer />
  </div>
);

export default Prime;