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

      <p className="mt-5 text-[17px] font-semibold leading-relaxed text-foreground">
        Key difference: BetweenTheLines builds psychological frameworks into its standard
        relationship report &mdash; without you having to write a specialist prompt.
      </p>
      <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
        Every Deep Read returns the same framework-based sections: attachment-style signals for each
        person and a Gottman &ldquo;Four Horsemen&rdquo; check for criticism, contempt, defensiveness
        and stonewalling, each tied to the messages it came from. These are interpretations of
        communication patterns in the text you supplied. They are not a clinical assessment, not a
        diagnosis, and not a validated psychological test.
      </p>
      <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
        ChatGPT is a general-purpose assistant. It can apply any framework you describe to a
        conversation you paste in, and it does that well. What it does not do by default is run a
        predefined relationship-report workflow: the import handling, the fixed section set, the
        computed counts and the redacted sharing are decisions this product makes for you.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-medium">Side by side</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
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
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">
                  Frameworks included in the standard report
                </th>
                <td className="py-3 pr-4">
                  Applies whichever framework you ask for in your prompt; no relationship framework is
                  included by default.
                </td>
                <td className="py-3">
                  Attachment-style signals and the Gottman Four Horsemen check are part of every Deep
                  Read, with no prompt to write.
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Scope of the tool</th>
                <td className="py-3 pr-4">General purpose: writing, research, code, images, voice, and conversation analysis.</td>
                <td className="py-3">One job: reading conversations between people.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Getting the chat in</th>
                <td className="py-3 pr-4">Paste text or upload a file; you decide what to send.</td>
                <td className="py-3">Guided import for WhatsApp and iMessage exports (TXT, CSV, ZIP), with participant preview, alias merging and exclusions before anything is analysed.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Output shape</th>
                <td className="py-3 pr-4">Whatever your prompt asks for; varies between attempts unless you re-specify it.</td>
                <td className="py-3">The same report structure every time: patterns, supporting evidence, counts where the data allows, and next steps.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Counting</th>
                <td className="py-3 pr-4">Model-generated; totals need checking against the file.</td>
                <td className="py-3">Message and participant counts are computed from the parsed export, not written by the model. Metrics the data cannot support are marked unavailable.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Groups</th>
                <td className="py-3 pr-4">A group chat can be discussed in a normal conversation.</td>
                <td className="py-3">A dedicated Group Read for 3&ndash;15 participants with per-person sections.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Sharing a result</th>
                <td className="py-3 pr-4">Copy, screenshot, or a chat share link you control.</td>
                <td className="py-3">Revocable share links with pseudonyms by default; names and quotes only if you switch them on.</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Price</th>
                <td className="py-3 pr-4">Free tier; Go US$8/month, Plus US$20/month, Pro US$200/month.</td>
                <td className="py-3">Free first read, $4.99 for a single report, $9.99/month or $49.99/year for full-report access.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 text-[16px] leading-relaxed text-muted-foreground">
        If you already have a prompt you trust and you like steering the analysis yourself, ChatGPT
        will do the job. If you want the framework sections, the computed counts and the redacted
        sharing without assembling them each time, that is what this product is. Neither tool
        diagnoses anyone or proves what a person was thinking.
      </p>

      <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground">
        Sources: openai.com/chatgpt/pricing and openai.com/index/introducing-chatgpt-go, retrieved
        16&nbsp;September&nbsp;2026. Prices change; check the vendor page for the current figure.
        BetweenTheLines rows describe features present in the product on that date.
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
