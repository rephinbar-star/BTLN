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
      <header className="sticky top-0 z-40 h-[58px] w-full border-b border-btln-line bg-btln-paper/95 backdrop-blur sm:h-[62px]">
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
              className="h-11 w-11 rounded-full text-btln-ink hover:bg-btln-mint"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Link
            to="/"
            aria-label="BetweenTheLines home"
            className="justify-self-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <BrandWordmark />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                aria-label="Open menu"
                size="icon"
                variant="ghost"
                className="h-11 w-11 rounded-full text-btln-ink hover:bg-btln-mint"
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
              <DropdownMenuItem className="min-h-11" onSelect={() => navigate("/explore")}>Explore</DropdownMenuItem>
              <DropdownMenuLabel className="pt-3 text-xs uppercase text-muted-foreground">Examples</DropdownMenuLabel>
              {EXAMPLES.map((example) => (
                <DropdownMenuItem key={example.kind} className="min-h-11 pl-5" onSelect={() => navigate(example.route)}>
                  {example.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem className="min-h-11 font-medium" onSelect={() => navigate("/examples")}>All examples</DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onSelect={() => navigate("/pricing")}>Plans and pricing</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="min-h-11" onSelect={() => navigate("/about")}>About</DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onSelect={() => navigate("/trust")}>Trust</DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onSelect={() => navigate("/privacy")}>Privacy</DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onSelect={() => navigate("/terms")}>Terms</DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onSelect={() => navigate("/guides/whatsapp")}>Guides</DropdownMenuItem>
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
