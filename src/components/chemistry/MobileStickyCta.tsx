import { ArrowRight } from "lucide-react";

const scrollToInput = () => {
  document.getElementById("input-section")?.scrollIntoView({ behavior: "smooth" });
};

export const MobileStickyCta = () => {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:hidden">
      <button
        onClick={scrollToInput}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-base font-medium text-background"
      >
        Start my analysis <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};