import { Helmet } from "react-helmet-async";
import { Header } from "@/components/chemistry/Header";
import { DecodeInput } from "@/components/chemistry/DecodeInput";
import { SeeExample } from "@/components/examples/ExampleExperience";
import { ModeIntro } from "@/components/ingest/ModeIntro";

const QuickTake = () => (
  <div className="min-h-screen bg-btln-paper text-foreground">
    <Helmet>
      <title>Quick Take — what did that text actually mean?</title>
      <meta
        name="description"
        content="Screenshot or paste one text and get the real read, what's underneath it, and three ways you could reply."
      />
      <link rel="canonical" href="https://betweenthelines.app/quick" />
    </Helmet>
    <Header />
    <main className="mx-auto max-w-5xl px-5 pb-20 pt-4 sm:px-8 md:grid md:grid-cols-2 md:items-start md:gap-10 md:pt-12">
      <div><ModeIntro kind="quick" /><div className="mt-4 hidden md:block"><SeeExample kind="quick" /></div></div>
      <div className="min-w-0 mt-6 md:mt-0">
        <DecodeInput />
        <div className="mt-4 md:hidden"><SeeExample kind="quick" /></div>
      </div>
      <p className="mt-6 text-[13px] text-muted-foreground">
        Your raw messages are deleted after processing. Your report may include selected excerpts. Your first read needs no signup.
      </p>
      </div>
    </main>
  </div>
);

export default QuickTake;
