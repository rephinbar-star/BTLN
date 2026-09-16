import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/components/marketing/PublicPage";
import { OPERATOR, hasOperatorIdentity } from "@/config/operator";

export default function About() {
  return <PublicPage title="About BetweenTheLines™ | Private Chat Analysis" description="How BetweenTheLines turns selected conversations into structured, private communication reports without claiming certainty about people." path="/about">
    <p className="text-sm text-muted-foreground">About the product</p>
    <h1 className="mt-3 text-[36px] font-medium leading-tight sm:text-[48px]">A clearer way to look at a conversation</h1>
    <div className="mt-8 space-y-7 text-[17px] leading-relaxed text-muted-foreground">
      <p>BetweenTheLines helps people reflect on selected romantic, friendship, family, and group conversations. It organizes message patterns, factual counts when the data supports them, selected evidence, and practical next steps into a consistent report.</p>
      <section><h2 className="text-xl font-medium text-foreground">Why use a structured read?</h2><p className="mt-3">A general-purpose chat prompt changes with every question. BetweenTheLines adds guided imports, participant mapping, deterministic counts, the same report structure across reads, access controls, and revocable sharing. Those product differences do not make any interpretation a fact.</p></section>
      <section><h2 className="text-xl font-medium text-foreground">What it does not do</h2><p className="mt-3">It does not diagnose people, prove hidden motives, replace therapy, or know what happened outside the supplied messages. Sparse or ambiguous evidence should produce cautious language and unavailable metrics—not invented certainty.</p></section>
      <section>
        <h2 className="text-xl font-medium text-foreground">Who operates it?</h2>
        {hasOperatorIdentity() ? <div className="mt-3 space-y-2">
          {OPERATOR.legalName ? <p>BetweenTheLines is operated by {OPERATOR.legalName}.</p> : null}
          {OPERATOR.founderName ? <p>{OPERATOR.founderName}{OPERATOR.founderRole ? `, ${OPERATOR.founderRole}` : ""}.</p> : null}
          {OPERATOR.postalAddress ? <p>{OPERATOR.postalAddress}</p> : null}
          {OPERATOR.contactEmail ? <p>Contact: <a className="underline" href={`mailto:${OPERATOR.contactEmail}`}>{OPERATOR.contactEmail}</a></p> : null}
        </div> : <p className="mt-3">BetweenTheLines is currently presented under the product name. A founder biography, operator name, company identity, and portrait have not been publicly verified, so this page does not invent them.</p>}
      </section>
      <section><h2 className="text-xl font-medium text-foreground">Your privacy choices</h2><p className="mt-3">Raw uploaded conversation text is processed for the requested read and is not stored as a reusable transcript. Structured reports may retain selected evidence excerpts. You control report sharing and can delete saved reports.</p></section>
    </div>
    <div className="mt-10 flex flex-wrap gap-3"><Button asChild className="rounded-full"><Link to="/sample">Explore a fictional sample</Link></Button><Button asChild variant="outline" className="rounded-full"><Link to="/trust">Read trust & safety</Link></Button></div>
  </PublicPage>;
}
