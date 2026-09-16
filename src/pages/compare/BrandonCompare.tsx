import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/components/marketing/PublicPage";
import { track } from "@/lib/analytics";

export default function BrandonCompare() {
  return (
    <PublicPage
      title="What Brandon Thinks vs BetweenTheLines | BetweenTheLines™"
      description="A sourced comparison of What Brandon Thinks and BetweenTheLines: a persona-voiced verdict on a chat export versus a structured, evidence-marked read."
      path="/compare/whatbrandonthinks-vs-betweenthelines"
    >
      <p className="text-sm text-muted-foreground">Comparison</p>
      <h1 className="mt-3 text-[36px] font-medium leading-tight sm:text-[48px]">
        What Brandon Thinks and BetweenTheLines read the same files, differently
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">
        What Brandon Thinks, published by L4Forge SAS in France, takes a WhatsApp or iMessage export
        and returns a report written in the voice of a character called Brandon: a verdict, an
        opinion on each person, and what he would do in your place. BetweenTheLines takes the same
        kind of export and returns a structured read with the same sections every time, counts
        computed from the file rather than written by the model, and sharing that hides names by
        default. One is a voice with a point of view; the other is a framework you can check.
      </p>

      <section className="mt-10">
        <p className="text-[17px] leading-relaxed">
          <strong>
            What Brandon Thinks is an entertainment novelty app. BetweenTheLines is a
            relationship decision support tool that&rsquo;s based on modern psychology concepts
            and frameworks.
          </strong>
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium">Side by side</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
            <caption className="sr-only">Comparison of What Brandon Thinks and BetweenTheLines</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-3 pr-4 font-medium">&nbsp;</th>
                <th scope="col" className="py-3 pr-4 font-medium">What Brandon Thinks</th>
                <th scope="col" className="py-3 font-medium">BetweenTheLines</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">
                  Frameworks included in the standard report
                </th>
                <td className="py-3 pr-4">Not described on the pages we reviewed; the documented output is Brandon&rsquo;s verdict and per-person opinions.</td>
                <td className="py-3 font-semibold">
                  Attachment-style signals, the Gottman Four Horsemen check and Five Love Languages
                  discovery are part of every Deep Read, without you having to become a psychologist or
                  prompt engineer &mdash; interpretations of communication patterns, using modern
                  psychology concepts and frameworks.
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Main job</th>
                <td className="py-3 pr-4">A character&rsquo;s verdict on the chat and on everyone in it.</td>
                <td className="py-3">A structured read of the pattern, with the evidence it used.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Tone</th>
                <td className="py-3 pr-4">Persona-led; the site says it can be funny, deep, or something to act on, &ldquo;depending on Brandon&rsquo;s mood&rdquo;.</td>
                <td className="py-3">Neutral by default. A separate opt-in Roast Us mode exists for people who want the jokes.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Imports</th>
                <td className="py-3 pr-4">WhatsApp exports from iPhone or Android; iMessage via their Mac app. The FAQ says other messaging apps are not supported yet.</td>
                <td className="py-3">Pasted text or a screenshot for a Quick Take; WhatsApp/iMessage TXT, CSV or ZIP exports for a Deep Read or Group Read.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Groups</th>
                <td className="py-3 pr-4">Group reports include an opinion on every member.</td>
                <td className="py-3">Group Read for 3&ndash;15 participants with per-person sections and computed participation stats.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Numbers in the report</th>
                <td className="py-3 pr-4">The published report description covers who texts first, the week things changed, and private language; it does not describe how figures are produced.</td>
                <td className="py-3">Message and participant counts are computed from the parsed export, not written by the model; metrics the data cannot support are marked unavailable.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Languages</th>
                <td className="py-3 pr-4">Chat in any language; report in English, French or Spanish.</td>
                <td className="py-3">Reports in English.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Sharing</th>
                <td className="py-3 pr-4">Reports are made to be screenshotted and shared; the site shows a wall of shared reports.</td>
                <td className="py-3">Revocable share links with pseudonyms by default; names and quotes only if you turn them on.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Retention</th>
                <td className="py-3 pr-4">Privacy policy: uploads auto-deleted within seven days of the most recent report, 48 hours if abandoned; reports kept until you delete them.</td>
                <td className="py-3">Raw pasted conversations are not persisted for Quick Take; imported files are processed and not stored as raw transcripts; you can delete reports and your account.</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Price</th>
                <td className="py-3 pr-4">Free preview of the first report, then pay per report. No price is published on the pages we reviewed, so we are not quoting a figure.</td>
                <td className="py-3">Free first read, $4.99 for a single report, $9.99/month or $49.99/year for full-report access.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Which should you use?</h2>
        <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">
          If you want a sharp, funny verdict you will want to screenshot into the group chat, Brandon
          is built for exactly that. If you want the same report shape each time, counts you can
          check against the file, and a shared version that hides names unless you choose otherwise,
          that is what this product is for. Neither tool diagnoses anyone, and neither can prove what
          a person was actually thinking.
        </p>
      </section>

      <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground">
        Sources: whatbrandonthinks.com home page and FAQ, and its privacy policy (updated
        24&nbsp;August&nbsp;2026, publisher L4Forge SAS, Ornex, France), all retrieved
        16&nbsp;September&nbsp;2026. Claims about that product are taken only from those pages and
        may change. Similarly named sites on other domains were not treated as the same operator.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          asChild
          className="rounded-full"
          onClick={() => track("guide_cta_clicked", { guide: "compare_brandon", destination: "quick_take" })}
        >
          <Link to="/">Read my conversation</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/sample">See a fictional sample first</Link>
        </Button>
      </div>
    </PublicPage>
  );
}
