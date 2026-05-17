import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: {
    priceId: string;
    customerEmail?: string;
    userId?: string;
    successUrl?: string;
    /** Attribution: which surface drove this checkout (last-click). */
    source?: string;
  }) => {
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);
      const customData: Record<string, string> = {};
      if (options.userId) customData.userId = options.userId;
      if (options.source) customData.source = options.source;
      const successBase =
        options.successUrl || `${window.location.origin}/welcome?checkout=success`;
      const successUrl = options.source
        ? `${successBase}${successBase.includes("?") ? "&" : "?"}src=${encodeURIComponent(options.source)}`
        : successBase;
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: Object.keys(customData).length ? customData : undefined,
        settings: {
          displayMode: "overlay",
          successUrl,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
