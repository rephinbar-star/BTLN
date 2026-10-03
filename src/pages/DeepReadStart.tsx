import { Helmet } from "react-helmet-async";
import { Header } from "@/components/chemistry/Header";
import { InputSection } from "@/components/chemistry/InputSection";
import { SeeExample } from "@/components/examples/ExampleExperience";
import { ModeIntro } from "@/components/ingest/ModeIntro";

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
    <main className="mx-auto max-w-5xl px-0 pb-20 pt-4 md:grid md:grid-cols-2 md:items-start md:gap-8 md:px-8 md:pt-12">
      <div className="px-5 sm:px-8 md:px-0"><ModeIntro kind="deep" /><div className="mt-4"><SeeExample kind="deep" /></div></div>
      <InputSection hideIntro />
    </main>
  </div>
);

export default DeepReadStart;
