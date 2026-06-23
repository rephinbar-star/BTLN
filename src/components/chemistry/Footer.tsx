import { useState } from "react";
import logoAsset from "@/assets/logo.png.asset.json";
import { FeedbackModal } from "./FeedbackModal";

export const Footer = () => {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <footer className="border-t border-border px-5 pt-0 pb-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 pt-0 pb-8 sm:px-8">
        <img src={logoAsset.url} alt="BetweenTheLines™" className="h-24 w-auto -mt-[3px]" />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[14px] text-muted-foreground">
          <a href="/trust" className="hover:text-foreground">Trust</a>
          <a href="/privacy" className="hover:text-foreground">Privacy</a>
          <a href="/terms" className="hover:text-foreground">Terms</a>
          <button
            type="button"
            onClick={() => setShowFeedback(true)}
            className="hover:text-foreground"
          >
            Feedback
          </button>
          <a href="/admin" className="hover:text-foreground">Admin</a>
        </nav>
      </div>
      {/* Spacer so sticky mobile CTA never overlaps footer */}
      <div className="h-16 sm:hidden" />

      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />
    </footer>
  );
};
