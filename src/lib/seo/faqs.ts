// FAQ content for public pages. The visible FAQ section on each page and the
// FAQPage JSON-LD (client Helmet + prerendered static HTML) are both built
// from this single source so they can never drift apart.

export interface FaqItem {
  question: string;
  answer: string;
}

export const WHATSAPP_GUIDE_FAQS: FaqItem[] = [
  {
    question: "How do I export a WhatsApp chat on iPhone?",
    answer:
      "Open the chat and tap the contact or group name, tap Export Chat, choose Without Media, then save or share the TXT/ZIP export.",
  },
  {
    question: "How do I export a WhatsApp chat on Android?",
    answer:
      "Open the chat and tap the menu, choose More, then Export chat, choose Without media, and save the TXT/ZIP export.",
  },
  {
    question: "Which WhatsApp export formats does BetweenTheLines support?",
    answer:
      "WhatsApp text exports from iOS and Android, including common localized dates, 12/24-hour clocks, multiline messages, UTF-8/BOM, and ZIP exports containing a transcript.",
  },
  {
    question: "What happens after I import a WhatsApp chat?",
    answer:
      "You choose the transcript when a ZIP contains candidates, review participants, merge aliases, exclude bots or people, decide how unknown times are handled, and confirm the relationship category. Two-person chats continue to Deep Read; 3–15 participants continue to Group Read.",
  },
];

export const BRANDON_COMPARE_FAQS: FaqItem[] = [
  {
    question: "What is the difference between What Brandon Thinks and BetweenTheLines?",
    answer:
      "What Brandon Thinks returns a report written in the voice of a character called Brandon: a verdict, an opinion on each person, and what he would do in your place. BetweenTheLines returns a structured read with the same sections every time, counts computed from the file rather than written by the model, and sharing that hides names by default.",
  },
  {
    question: "Which messaging apps does each service import?",
    answer:
      "What Brandon Thinks imports WhatsApp exports from iPhone or Android and iMessage via their Mac app; its FAQ says other messaging apps are not supported yet. BetweenTheLines accepts pasted text or a screenshot for a Quick Take, and WhatsApp/iMessage TXT, CSV or ZIP exports for a Deep Read or Group Read.",
  },
  {
    question: "How do the two services handle privacy?",
    answer:
      "What Brandon Thinks' privacy policy says uploads are auto-deleted within seven days of the most recent report, or 48 hours if abandoned, and reports are kept until you delete them. BetweenTheLines does not persist raw pasted conversations for Quick Take, processes imported files without storing raw transcripts, and lets you delete reports and your account.",
  },
  {
    question: "Do the reports show how their numbers are produced?",
    answer:
      "What Brandon Thinks' published report description covers who texts first, the week things changed, and private language, but does not describe how figures are produced. BetweenTheLines computes message and participant counts from the parsed export, not the model, and marks metrics the data cannot support as unavailable.",
  },
];

export function faqPageJsonLd(items: FaqItem[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  });
}
