import { Helmet } from "react-helmet-async";
import { Header } from "@/components/chemistry/Header";
import { InputSection } from "@/components/chemistry/InputSection";
import { SeeExample } from "@/components/examples/ExampleExperience";

const DeepReadStart = () => (
  <div className="min-h-screen bg-btln-paper text-foreground">
    <Helmet>
      <title>Deep Read — the full read on the two of you</title>
      <meta
        name="description"
        content="Paste or upload a two-person conversation and get a structured read of your patterns, attachment signals and what to try next."
      />
      <link rel="canonical" href="https://betweenthelines.app/deep" />
    </Helmet>
    <Header />
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-4 sm:px-8">
      <h1 className="text-[33px] font-medium leading-[1.08] tracking-[-1.15px] sm:text-[40px]">
        The two of us
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        Does the same thing keep happening between you? Bring a chat export, a paste, or
        screenshots. You'll get attachment-style signals, the Gottman Four Horsemen check,
        Five Love Languages discovery and practical next steps — read as communication
        patterns, not a clinical assessment.
      </p>
      <SeeExample kind="deep" />
      <InputSection hideIntro />
    </main>
  </div>
);

export default DeepReadStart;
