import { Lock } from "lucide-react";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  analysisId: string;
  priceLabel?: string;
}

export function UnlockReportButton({ analysisId, priceLabel = "$4.99" }: Props) {
  const { user } = useAuth();
  const { openCheckout, checkoutElement, isOpen, closeCheckout } = useStripeCheckout();

  const handleClick = () => {
    openCheckout({
      priceId: "report_unlock_one_time",
      customerEmail: user?.email,
      userId: user?.id,
      analysisId,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}&analysis_id=${analysisId}`,
    });
  };

  if (isOpen) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        {checkoutElement}
        <button
          type="button"
          onClick={closeCheckout}
          className="mt-4 w-full text-center text-[13px] text-muted-foreground underline-offset-2 hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90"
    >
      <Lock className="h-4 w-4" /> Unlock full report — {priceLabel}
    </button>
  );
}