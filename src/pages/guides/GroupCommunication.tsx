import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/components/marketing/PublicPage";
import { track } from "@/lib/analytics";
export default function GroupCommunicationGuide() {
  return <PublicPage title="Understand Friend & Family Group Chats | BetweenTheLines™" description="Learn how Group Read maps participation, repair, strengths, and practical next steps across friend and family chats." path="/guides/group-chat-communication">
    <p className="text-sm text-muted-foreground">Group Read guide</p><h1 className="mt-3 text-[36px] font-medium leading-tight sm:text-[48px]">See how your group actually communicates</h1>
    <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">Group Read supports 3–15 participants. It keeps each sender separate, calculates factual participation counts across the selected history, and avoids assigning a forced role when evidence is sparse.</p>
    <section className="mt-10 rounded-lg border border-border bg-card p-6"><p className="text-xs font-semibold uppercase text-muted-foreground">Fictional family example</p><h2 className="mt-3 text-lg font-medium">Pattern</h2><p className="mt-2 text-muted-foreground">Two people handle planning while quieter members respond only after a decision is nearly settled.</p><h2 className="mt-5 text-lg font-medium">Evidence</h2><p className="mt-2 text-muted-foreground">Across four plans, the same two participants start the thread and ask the follow-up questions.</p><h2 className="mt-5 text-lg font-medium">Next step</h2><p className="mt-2 text-muted-foreground">Ask for preferences before proposing the final option, then give quieter members a clear response window.</p></section>
    <p className="mt-7 text-sm leading-relaxed text-muted-foreground">Paste attributed text or upload supported TXT, CSV, or WhatsApp ZIP exports. Files stay in browser memory until processing; reports retain structured results and may contain selected evidence excerpts. Up to 12,000 messages are accepted within the displayed file and archive limits.</p>
    <Button asChild className="mt-7 rounded-full" onClick={() => track("guide_cta_clicked", { guide: "group_communication", destination: "group_read" })}><Link to="/group">Read a group chat</Link></Button>
  </PublicPage>;
}
