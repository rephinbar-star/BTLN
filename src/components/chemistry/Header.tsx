import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { logEvent } from "@/lib/session";
import { useAuth } from "@/hooks/useAuth";

const scrollToInput = (location: string) => {
  logEvent("cta_clicked", { location });
  document.getElementById("input-section")?.scrollIntoView({ behavior: "smooth" });
};

export const Header = () => {
  const { user, loading } = useAuth();
  return (
    <header className="sticky top-0 z-40 w-full bg-background/90 backdrop-blur border-b border-border/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/" className="flex items-center gap-2">
          <Heart className="h-5 w-5 fill-foreground text-foreground" strokeWidth={0} />
          <span className="text-base font-medium tracking-tight">Chemistry</span>
        </Link>
        <div className="flex items-center gap-2">
          {!loading && (
            user ? (
              <Link
                to="/account"
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
              >
                My account
              </Link>
            ) : (
              <Link
                to="/auth"
                className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
            )
          )}
          <button
            onClick={() => scrollToInput("header")}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            Try it free
          </button>
        </div>
      </div>
    </header>
  );
};