import { Link, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useMembership } from "@/hooks/useMembership";

type Props = {
  /** Where the user should come back to after looking at Prime. */
  returnTo?: string;
  className?: string;
};

/**
 * Compact Prime offer shown at purchase entry points.
 * It links to the /prime page — it never starts a checkout here, so it can
 * never imply a purchase is possible before the plan is live.
 */
export const PrimeOffer = ({ returnTo, className = "" }: Props) => {
  const { pathname, search } = useLocation();
  const { isMember, loading } = useMembership();
  const back = returnTo ?? `${pathname}${search}`;

  if (loading) return null;

  return (
    <div
      className={`rounded-[20px] border border-btln-line bg-btln-mint/60 p-[18px] ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-2xl bg-background">
          <Sparkles className="h-5 w-5 text-btln-forest" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-medium">
            {isMember ? "Prime — included in your plan soon" : "Prime — $19.99/month"}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
            Understand who you are in your relationships—and how you're changing.
          </p>
          <Link
            to={`/prime?return_to=${encodeURIComponent(back)}`}
            className="mt-3 inline-flex min-h-[44px] items-center text-[14px] font-medium text-btln-forest underline-offset-4 hover:underline"
          >
            {isMember ? "See what Prime adds" : "See what's in Prime"} →
          </Link>
        </div>
      </div>
    </div>
  );
};
