import { Helmet } from "react-helmet-async";
import { Header } from "@/components/chemistry/Header";
import { DecodeInput } from "@/components/chemistry/DecodeInput";
import { SeeExample } from "@/components/examples/ExampleExperience";

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
    <main className="mx-auto max-w-2xl px-5 pb-20 pt-4 sm:px-8">
      <h1 className="text-[33px] font-medium leading-[1.08] tracking-[-1.15px] sm:text-[40px]">
        One text
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        Stuck on what they meant—or what to say back? Add the screenshot or paste the message.
        You'll get the likely read, what's going on underneath, and three replies you could send.
      </p>
      <SeeExample kind="quick" />
      <div className="mt-6">
        <DecodeInput />
      </div>
      <p className="mt-6 text-[13px] text-muted-foreground">
        Nothing you paste is kept in your browser. Your first read needs no signup.
      </p>
    </main>
  </div>
);

export default QuickTake;
