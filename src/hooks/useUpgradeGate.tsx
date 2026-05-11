import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { UpgradeModal, type RequiredTier } from "@/components/UpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";

type GateState = { open: boolean; tier: RequiredTier; feature: string };

interface GateContextValue {
  /** Returns true if the user has access; false if the modal was opened. */
  requireTier: (tier: RequiredTier, featureName: string) => boolean;
  openUpgrade: (tier: RequiredTier, featureName: string) => void;
}

const GateContext = createContext<GateContextValue | null>(null);

export function UpgradeGateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ open: false, tier: "plus", feature: "" });
  const sub = useSubscription();

  const openUpgrade = useCallback((tier: RequiredTier, featureName: string) => {
    setState({ open: true, tier, feature: featureName });
  }, []);

  const requireTier = useCallback(
    (tier: RequiredTier, featureName: string) => {
      const ok = tier === "plus" ? sub.isPlus : sub.isPro;
      if (!ok) {
        setState({ open: true, tier, feature: featureName });
        return false;
      }
      return true;
    },
    [sub.isPlus, sub.isPro],
  );

  const value = useMemo(() => ({ requireTier, openUpgrade }), [requireTier, openUpgrade]);

  return (
    <GateContext.Provider value={value}>
      {children}
      <UpgradeModal
        open={state.open}
        onClose={() => setState((s) => ({ ...s, open: false }))}
        requiredTier={state.tier}
        featureName={state.feature}
      />
    </GateContext.Provider>
  );
}

export function useUpgradeGate(): GateContextValue {
  const ctx = useContext(GateContext);
  if (!ctx) throw new Error("useUpgradeGate must be used inside <UpgradeGateProvider>");
  return ctx;
}
