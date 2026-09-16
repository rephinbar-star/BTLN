import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/components/marketing/PublicPage";
import { track } from "@/lib/analytics";

export default function ChatGPTCompare() {
  return (
    <PublicPage
      title="BetweenTheLines vs ChatGPT for Reading a Chat | BetweenTheLines™"
      description="An evidence-based comparison of using ChatGPT directly versus BetweenTheLines for analysing a WhatsApp or iMessage conversation, with sources and dates."
      path="/compare/chatgpt-vs-betweenthelines"
    >
      <p className="text-sm text-muted-foreground">Comparison</p>
      <h1 className="mt-3 text-[36px] font-medium leading-tight sm:text-[48px]">
        &ldquo;Why not just paste it into ChatGPT?&rdquo;
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">
        It is a fair question, and for many people ChatGPT is the right answer. ChatGPT is a
        general-purpose assistant: it accepts file uploads and pasted text, it can follow a
        framework you describe, and it can return structured output if you ask for it. What it does
        not do is decide for you how a conversation should be imported, counted, laid out or shared.
        That is the whole of what BetweenTheLines adds.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-medium">Where ChatGPT is genuinely better</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] leading-relaxed text-muted-foreground">
          <li>It is open-ended. You can ask anything, change direction mid-conversation, and keep going.</li>
          <li>It handles far more than conversations — writing, research, code, images, voice.</li>
          <li>A free tier exists, so a one-off question costs nothing.</li>
          <li>You can specify your own framework and your own output format.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium">Where a purpose-built read differs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[540px] border-collapse text-left text-[15px]">
            <caption className="sr-only">Workflow comparison</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-3 pr-4 font-medium">Workflow step</th>
                <th scope="col" className="py-3 pr-4 font-medium">ChatGPT</th>
                <th scope="col" className="py-3 font-medium">BetweenTheLines</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Getting the chat in</th>
                <td className="py-3 pr-4">Paste text or upload a file; you decide what to send and how.</td>
                <td className="py-3">Guided import for WhatsApp and iMessage exports (TXT, CSV, ZIP), with participant preview, alias merging and exclusions before anything is analysed.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Default output</th>
                <td className="py-3 pr-4">Whatever your prompt asks for; varies between attempts unless you re-specify it.</td>
                <td className="py-3">The same report structure every time: patterns, supporting evidence, counts where the data allows, and next steps.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Counting</th>
                <td className="py-3 pr-4">Model-generated; you would need to verify totals yourself.</td>
                <td className="py-3">Message and participant counts are computed from the parsed export, not written by the model. Metrics that the data cannot support are marked unavailable.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Groups</th>
                <td className="py-3 pr-4">You can ask about a group chat in a normal conversation.</td>
                <td className="py-3">A dedicated Group Read for 3&ndash;15 participants with per-person sections.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Sharing a result</th>
                <td className="py-3 pr-4">Copy, screenshot, or a chat share link that you control.</td>
                <td className="py-3">Revocable share links with pseudonyms by default; names and quotes are only included if you switch them on.</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Price</th>
                <td className="py-3 pr-4">
                  Free tier; Go US$8/month, Plus US$20/month, Pro US$200/month (OpenAI, January&nbsp;2026).
                </td>
                <td className="py-3">Free first read, $4.99 for a single report, $9.99/month or $49.99/year for full-report access.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Which should you use?</h2>
        <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">
          If you already have a prompt you trust and you enjoy steering the analysis yourself,
          ChatGPT will serve you well. If you want a long export handled for you, the same shape of
          report each time, counts you can check, and a shareable version that hides names by
          default, that is what this product is for. Neither one diagnoses anybody or proves what
          someone was thinking.
        </p>
      </section>

      <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground">
        Sources: openai.com/chatgpt/pricing and openai.com/index/introducing-chatgpt-go, retrieved
        16&nbsp;September&nbsp;2026. Prices change; check the vendor page for the current figure.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          asChild
          className="rounded-full"
          onClick={() => track("guide_cta_clicked", { guide: "compare_chatgpt", destination: "quick_take" })}
        >
          <Link to="/">Try a read on your own chat</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/sample">See a fictional sample first</Link>
        </Button>
      </div>
    </PublicPage>
  );
}
