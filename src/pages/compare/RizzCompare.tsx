import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/components/marketing/PublicPage";
import { track } from "@/lib/analytics";

export default function RizzCompare() {
  return (
    <PublicPage
      title="RIZZ vs BetweenTheLines: Replies or a Read? | BetweenTheLines™"
      description="RIZZ suggests what to send next; BetweenTheLines explains the pattern across a conversation. A sourced comparison of the two workflows."
      path="/compare/rizz-vs-betweenthelines"
    >
      <p className="text-sm text-muted-foreground">Comparison</p>
      <h1 className="mt-3 text-[36px] font-medium leading-tight sm:text-[48px]">
        RIZZ and BetweenTheLines solve different problems
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">
        RIZZ, published by TREND IT LLC, is a mobile AI dating assistant: you upload a screenshot of
        a conversation (and optionally a match&rsquo;s bio) and it suggests replies in a tone you
        pick. BetweenTheLines does not write your next message for you &mdash; it looks across a
        longer conversation and describes the pattern, with the evidence it used. If what you want
        is a better opener, RIZZ is the more direct tool.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-medium">What RIZZ does well</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] leading-relaxed text-muted-foreground">
          <li>Fast, in-the-moment reply suggestions from a screenshot.</li>
          <li>Tone options, including a formal mode for networking messages.</li>
          <li>Native iPhone, iPad and Android apps; free to install with in-app purchases.</li>
          <li>A large, well-rated audience: 4.8 stars from roughly 39,000 US App Store ratings, and 5M+ Google Play downloads.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium">Side by side</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[540px] border-collapse text-left text-[15px]">
            <caption className="sr-only">Workflow comparison</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-3 pr-4 font-medium">&nbsp;</th>
                <th scope="col" className="py-3 pr-4 font-medium">RIZZ</th>
                <th scope="col" className="py-3 font-medium">BetweenTheLines</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Main job</th>
                <td className="py-3 pr-4">Suggest what to send next.</td>
                <td className="py-3">Explain the pattern across a conversation.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">What you supply</th>
                <td className="py-3 pr-4">Screenshots of a chat and, optionally, a match&rsquo;s bio.</td>
                <td className="py-3">Pasted text or screenshots for a Quick Take; full WhatsApp/iMessage TXT, CSV or ZIP exports for a Deep Read or Group Read.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Scope</th>
                <td className="py-3 pr-4">Dating first, with friends, family and professional tones available.</td>
                <td className="py-3">Two-person romantic, friend and family reads, plus group chats of 3&ndash;15 people.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Where it runs</th>
                <td className="py-3 pr-4">iOS and Android apps.</td>
                <td className="py-3">Browser, no install.</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Sharing</th>
                <td className="py-3 pr-4">Not documented on the store listing we reviewed.</td>
                <td className="py-3">Revocable share links, pseudonyms by default, names and quotes only if you turn them on.</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 font-normal text-foreground">Price</th>
                <td className="py-3 pr-4">
                  Free to install with in-app purchases; the US App Store listing shows items from
                  $3.99 to $99.99, including a $69.99 one-year option.
                </td>
                <td className="py-3">Free first read, $4.99 for a single report, $9.99/month or $49.99/year for full-report access.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 text-[16px] leading-relaxed text-muted-foreground">
        Plenty of people will want both: something to help with the next message, and something that
        steps back across months of messages. Neither tool knows what anybody was actually thinking.
      </p>

      <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground">
        Sources: the RIZZ US App Store listing (apps.apple.com/us/app/rizz/id1663430725) and Google
        Play listing (com.rizzlabs.rizz), retrieved 16&nbsp;September&nbsp;2026. Ratings, download
        counts and in-app purchase prices change over time and vary by store and region.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          asChild
          className="rounded-full"
          onClick={() => track("guide_cta_clicked", { guide: "compare_rizz", destination: "quick_take" })}
        >
          <Link to="/">Read my conversation</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/compare/chatgpt-vs-betweenthelines">Compare with ChatGPT</Link>
        </Button>
      </div>
    </PublicPage>
  );
}
