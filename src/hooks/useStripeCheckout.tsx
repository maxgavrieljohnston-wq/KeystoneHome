import { useCallback, useState } from "react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

interface CheckoutOptions {
  priceId: string;
  customerEmail?: string;
  userId?: string;
  source?: string;
  successUrl?: string;
}

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkMute: "#6b6b6b",
};

export function useStripeCheckout() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [loading, setLoading] = useState(false);

  const openCheckout = useCallback(async (opts: CheckoutOptions) => {
    setLoading(true);
    setOptions(opts);
    setIsOpen(true);
    setLoading(false);
  }, []);

  const closeCheckout = useCallback(() => {
    setIsOpen(false);
    setOptions(null);
  }, []);

  const returnBase =
    options?.successUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/welcome?checkout=success`
      : "/welcome?checkout=success");
  const returnUrl = options?.source
    ? `${returnBase}${returnBase.includes("?") ? "&" : "?"}src=${encodeURIComponent(options.source)}`
    : returnBase;

  const checkoutElement =
    isOpen && options ? (
      <div
        role="dialog"
        aria-modal="true"
        onClick={closeCheckout}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(26,26,26,0.65)",
          zIndex: 2000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          overflowY: "auto",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: C.paper,
            borderRadius: 14,
            maxWidth: 540,
            width: "100%",
            maxHeight: "92vh",
            overflowY: "auto",
            padding: 20,
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={closeCheckout}
            aria-label="Close checkout"
            style={{
              position: "absolute",
              top: 8,
              right: 12,
              background: "transparent",
              border: "none",
              fontSize: 28,
              cursor: "pointer",
              color: C.inkMute,
              lineHeight: 1,
              zIndex: 1,
            }}
          >
            ×
          </button>
          <StripeEmbeddedCheckout
            priceId={options.priceId}
            customerEmail={options.customerEmail}
            userId={options.userId}
            source={options.source}
            returnUrl={returnUrl}
          />
        </div>
      </div>
    ) : null;

  return { openCheckout, closeCheckout, isOpen, loading, checkoutElement };
}
