import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "./FeedbackModal";
import { OPERATOR } from "@/config/operator";
import { BrandWordmark } from "./BrandWordmark";
import { EXAMPLES } from "@/lib/examples/catalog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const backTarget = (pathname: string, returnTo: string | null) => {
  if (pathname === "/prime" && returnTo?.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
  if (pathname === "/explore" || pathname === "/account") return "/";
  if (pathname === "/journey") return "/explore";
  if (pathname === "/quick" || pathname === "/deep" || pathname === "/group-roast") return "/";
  if (pathname === "/group") return "/explore";
  if (pathname === "/roast") return "/explore";
  if (pathname.startsWith("/decode/")) return "/quick";
  if (pathname.startsWith("/group/")) return "/group";
  if (pathname.startsWith("/roast/")) return "/roast";
  if (pathname.startsWith("/report/")) return "/deep";
  return "/";
};

export const Header = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [showFeedback, setShowFeedback] = useState(false);
  const home = pathname === "/";
  const fallback = backTarget(pathname, params.get("return_to"));

  return (
    <>
      <header className="sticky top-0 z-40 h-[58px] w-full border-b border-btln-line prism-chrome sm:h-[62px]">
        <div className="mx-auto grid h-full max-w-6xl grid-cols-[44px_1fr_44px] items-center px-[19px]">
          {home ? (
            <span aria-hidden className="h-11 w-11" />
          ) : (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Go back"
              onClick={() => navigate(fallback)}
              className="h-11 w-11 rounded-full text-foreground hover:bg-elevated"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Link
            to="/"
            aria-label="BetweenTheLines home"
            className="justify-self-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="wordmark-plate"><BrandWordmark /></span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                aria-label="Open menu"
                size="icon"
                variant="ghost"
                className="h-11 w-11 rounded-full text-foreground hover:bg-elevated"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[calc(100vh-76px)] w-60 overflow-y-auto p-2">
              {!loading && (
                <DropdownMenuItem className="min-h-11" onSelect={() => navigate(user ? "/account" : "/auth?mode=signin")}>
                  {user ? "My reads and account" : "Log in or register"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild className="min-h-11"><Link to="/explore">Explore</Link></DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11"><Link to="/pricing">Pricing</Link></DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11"><Link to="/sample">See a sample</Link></DropdownMenuItem>
              <DropdownMenuLabel className="pt-3 text-xs uppercase text-muted-foreground">Examples</DropdownMenuLabel>
              {/* Two-person "Roast Us" stays reachable via Explore and /roast, and
                  Relationship Wrapped stays reachable via Explore and its routes, but
                  neither is a main-menu entry. Group Roast (3+) remains listed. */}
              {EXAMPLES.filter((example) => example.kind !== "roast" && example.kind !== "wrapped").map((example) => (
                <DropdownMenuItem key={example.kind} asChild className="min-h-11 pl-5"><Link to={example.route}>{example.name}</Link></DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild className="min-h-11 font-medium"><Link to="/examples">All examples</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="min-h-11"><Link to="/about">About</Link></DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11"><Link to="/trust">Trust</Link></DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11"><Link to="/privacy">Privacy</Link></DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11"><Link to="/terms">Terms</Link></DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11"><Link to="/guides/whatsapp">Guides</Link></DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onSelect={() => { window.location.href = `mailto:${OPERATOR.contactEmail}`; }}>Contact</DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onSelect={() => setShowFeedback(true)}>Feedback</DropdownMenuItem>
              {user && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="min-h-11" onSelect={() => void signOut().then(() => navigate("/"))}>
                    Sign out
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />
    </>
  );
};
