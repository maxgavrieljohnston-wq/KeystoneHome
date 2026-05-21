import { useState, useEffect } from "react";
import { getStripeEnvironment } from "@/lib/stripe";

export function PaymentTestModeBanner() {
  const [devBypass, setDevBypass] = useState(false);

  useEffect(() => {
    setDevBypass(localStorage.getItem("dev_bypass_pro") === "true");
  }, []);

  const toggleBypass = () => {
    const next = !devBypass;
    setDevBypass(next);
    localStorage.setItem("dev_bypass_pro", String(next));
    window.dispatchEvent(new Event("dev_bypass_changed"));
  };

  if (getStripeEnvironment() !== "sandbox") return null;
  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 flex items-center justify-between text-sm text-orange-800">
      <div className="flex-1 text-center">
        All payments made in the preview are in test mode.{" "}
        <a
          href="https://docs.lovable.dev/features/payments#test-and-live-environments"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium"
        >
          Read more
        </a>
      </div>
      {import.meta.env.DEV && (
        <button
          onClick={toggleBypass}
          className="ml-4 px-3 py-1 bg-orange-200 hover:bg-orange-300 rounded font-medium text-xs whitespace-nowrap transition-colors"
        >
          {devBypass ? "Disable Pro Bypass" : "Enable Pro Bypass"}
        </button>
      )}
    </div>
  );
}
