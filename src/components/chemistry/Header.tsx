import { Heart } from "lucide-react";

const scrollToInput = () => {
  document.getElementById("input-section")?.scrollIntoView({ behavior: "smooth" });
};

export const Header = () => {
  return (
    <header className="sticky top-0 z-40 w-full bg-background/90 backdrop-blur border-b border-border/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="/" className="flex items-center gap-2">
          <Heart className="h-5 w-5 fill-foreground text-foreground" strokeWidth={0} />
          <span className="text-base font-medium tracking-tight">Chemistry</span>
        </a>
        <button
          onClick={scrollToInput}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
        >
          Try it free
        </button>
      </div>
    </header>
  );
};