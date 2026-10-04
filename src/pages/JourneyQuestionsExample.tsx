import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import { QuestionsView } from "@/components/relationship360/QuestionsView";
import type { AskResult } from "@/lib/relationship360/ask";

// Fictional, isolated fixture. No model calls, no writes, no account data.
const SOURCES = [
  { id: "ex-1", label: "Quick Take · Plans with Alex", detail: "Sep 18 (fictional)" },
  { id: "ex-2", label: "Deep Read · Check-in with Jordan", detail: "Sep 24 (fictional)" },
  { id: "ex-3", label: "Quick Take · Weekend with Sam", detail: "Sep 25 (fictional)" },
];
const ANSWER: AskResult = {
  state: "answered",
  title: "What keeps repeating?",
  finding: "In two of these reads, you ask for reassurance when a reply feels unclear. That may be a pattern worth noticing.",
  note_context: "Your note describes slow replies feeling like rejection.",
  next_step: "Ask one clear question, then give the other person time to answer.",
  moments: [
    { kind: "conversation", ref_id: "m1", source_id: "ex-1", label: "Plans with Alex", date: "2026-09-18", date_kind: "verified", actor: "Your message", text: "You asked whether the plan was still on after a short reply.", quote: null },
    { kind: "conversation", ref_id: "m2", source_id: "ex-2", label: "Check-in with Jordan", date: "2026-09-24", date_kind: "verified", actor: "Your message", text: "You checked whether Jordan was upset after a delayed answer.", quote: null },
    { kind: "note", ref_id: "m3", source_id: null, label: "My reflection", date: "2026-09-26", date_kind: "written", actor: "Your note", text: "Slow replies make me feel like I did something wrong.", quote: null },
  ],
  limitation: "Based on the sources you included. A reflection, not a verdict.",
  support: { sources: 2, dated: 2, notes: 1 },
};

export default function JourneyQuestionsExample() {
  const [question, setQuestion] = useState("What keeps repeating?");
  const [shown, setShown] = useState(true);
  return (
    <div className="prime-page min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Fictional example — Ask about your patterns</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Header />
      <QuestionsView
        banner="Fictional example · No live data or AI calls"
        question={question}
        onQuestion={(q) => { setQuestion(q); setShown(false); }}
        onAsk={() => setShown(true)}
        asking={false}
        canAsk={question.trim() === "What keeps repeating?"}
        sources={SOURCES}
        selected={SOURCES.map((s) => s.id)}
        notes={[{ id: "ex-n1", label: "My reflection · Sep 26 (fictional)", excerpt: "Slow replies make me feel like I did something wrong." }]}
        selectedNotes={["ex-n1"]}
        sourceSummary="Based on 3 fictional reads and 1 note"
        result={shown ? ANSWER : null}
        askedQuestion={question}
        error={null}
        emptyAnswerText="This fictional example only shows an answer for “What keeps repeating?”. No AI is called here."
      />
      <Footer />
    </div>
  );
}
