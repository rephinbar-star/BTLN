import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";

interface Props {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  userId?: string;
  analysisId?: string;
  customerCountry?: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({
  priceId,
  quantity,
  customerEmail,
  userId,
  analysisId,
  customerCountry,
  returnUrl,
}: Props) {
  const [configError, setConfigError] = useState<string | null>(null);

  const stripePromise = useMemo(() => {
    try {
      return getStripe();
    } catch (e) {
      setConfigError(
        e instanceof Error ? e.message : "Payment configuration is missing.",
      );
      return null;
    }
  }, []);

  const fetchClientSecret = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        priceId,
        quantity,
        customerEmail,
        userId,
        analysisId,
        customerCountry,
        returnUrl,
        environment: getStripeEnvironment(),
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || "Failed to create checkout session");
    }
    return data.clientSecret;
  };

  if (configError || !stripePromise) {
    return (
      <div
        id="checkout"
        role="alert"
        className="rounded-xl border border-border bg-muted p-4 text-[13px] text-muted-foreground"
      >
        Checkout is temporarily unavailable. Please try again in a moment, or
        contact support@betweenthelines.app if the problem persists.
      </div>
    );
  }

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}