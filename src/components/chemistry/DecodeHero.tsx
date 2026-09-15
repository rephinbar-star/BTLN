import { DecodeInput } from "./DecodeInput";

const scrollToInput = () => {
  document.getElementById("input-section")?.scrollIntoView({ behavior: "smooth" });
};

export const DecodeHero = () => (
  <section className="mx-auto max-w-6xl px-5 pb-8 pt-10 sm:px-8 sm:pb-10 sm:pt-14 lg:pt-16">
    <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
      <div>
        <p className="text-sm text-muted-foreground">Quick Take</p>
        <h1 className="mt-4 text-[32px] font-medium leading-[1.05] tracking-tight sm:text-[40px] lg:text-[52px]">
          What does this text actually mean?
        </h1>
        <p className="mt-5 max-w-[560px] text-[18px] leading-relaxed text-muted-foreground sm:text-[20px]">
          Screenshot it, paste it, stop re-reading it. In seconds you'll get the real read, what's going on
          underneath, and three ways you could reply.
        </p>
        <ul className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
          <li className="font-medium text-foreground">Quick Take</li>
          <li aria-hidden>·</li>
          <li>
            <button onClick={scrollToInput} className="underline-offset-4 hover:text-foreground hover:underline">
              Deep Read
            </button>
          </li>
          <li aria-hidden>·</li>
          <li>Roast Us <span className="opacity-70">(soon)</span></li>
          <li aria-hidden>·</li>
          <li>Group Read <span className="opacity-70">(soon)</span></li>
        </ul>
        <button
          onClick={scrollToInput}
          className="mt-4 text-[14px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Want the full read on you two? →
        </button>
      </div>
      <div>
        <DecodeInput />
      </div>
    </div>
  </section>
);