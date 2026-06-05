import { Heart } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { logEvent } from "@/lib/session";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const scrollToInput = (location: string) => {
  logEvent("cta_clicked", { location });
  document.getElementById("input-section")?.scrollIntoView({ behavior: "smooth" });
};

export const Header = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const initial = (user?.email ?? "?").charAt(0).toUpperCase();
  const truncEmail =
    user?.email && user.email.length > 24 ? `${user.email.slice(0, 21)}…` : user?.email ?? "";
  return (
    <header className="sticky top-0 z-40 w-full bg-background/90 backdrop-blur border-b border-border/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/" className="flex items-center gap-2">
          <Heart className="h-5 w-5 fill-foreground text-foreground" strokeWidth={0} />
          <span className="text-base font-medium tracking-tight">BetweenTheLines</span>
        </Link>
        <div className="flex items-center gap-2">
          {!loading && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Account menu"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  {initial}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                  {truncEmail}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/account")}>
                  My reports
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/account")}>
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    void signOut().then(() => navigate("/"));
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              {!loading && (
                <Link
                  to="/auth?mode=signin"
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
                >
                  Sign Up/In
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
};