import { useState } from "react";
import logoUrl from "@/assets/logo.png";
import { FeedbackModal } from "./FeedbackModal";
import { OPERATOR } from "@/config/operator";
import { Button } from "@/components/ui/button";

export const Footer = () => {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <footer className="border-t border-border px-5 pt-0 pb-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 pt-0 pb-8 sm:px-8">
        <img src={logoUrl} alt="BetweenTheLines™" className="h-20 w-auto object-contain" />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[14px] text-muted-foreground">
          <a href="/sample" className="hover:text-foreground">Sample</a>
          <a href="/pricing" className="hover:text-foreground">Pricing</a>
          <a href="/about" className="hover:text-foreground">About</a>
          <a href="/types" className="hover:text-foreground">Pair types</a>
          <a href="/compare/chatgpt-vs-betweenthelines" className="hover:text-foreground">Compare</a>
          <a href="/trust" className="hover:text-foreground">Trust</a>
          <a href="/privacy" className="hover:text-foreground">Privacy</a>
          <a href="/terms" className="hover:text-foreground">Terms</a>
          <a href={`mailto:${OPERATOR.contactEmail}`} className="hover:text-foreground">Contact</a>
          <Button
            type="button"
            variant="link"
            onClick={() => setShowFeedback(true)}
            className="h-auto p-0 font-normal text-muted-foreground hover:text-foreground"
          >
            Feedback
          </Button>
          <a href="/guides/whatsapp" className="hover:text-foreground">Guides</a>
        </nav>
      </div>
      {/* Spacer so sticky mobile CTA never overlaps footer */}
      <div className="h-16 sm:hidden" />

      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />
    </footer>
  );
};
