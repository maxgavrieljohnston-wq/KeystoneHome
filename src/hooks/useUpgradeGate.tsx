import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { UpgradeModal, type RequiredTier } from "@/components/UpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";
import { trackUpgradeEvent, type UpgradeSource } from "@/lib/upgrade-tracking";

type GateState = {
  open: boolean;
  tier: RequiredTier;
  feature: string;
  source: UpgradeSource | string;
};

interface GateContextValue {
  /** Returns true if the user has access; false if the modal was opened. */
  requireTier: (tier: RequiredTier, featureName: string, source: UpgradeSource | string) => boolean;
  openUpgrade: (tier: RequiredTier, featureName: string, source: UpgradeSource | string) => void;
}

const GateContext = createContext<GateContextValue | null>(null);

export function UpgradeGateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({
    open: false,
    tier: "plus",
    feature: "",
    source: "unknown",
  });
  const sub = useSubscription();

  const openUpgrade = useCallback(
    (tier: RequiredTier, featureName: string, source: UpgradeSource | string) => {
      trackUpgradeEvent({ event_type: "cta_click", source, tier });
      setState({ open: true, tier, feature: featureName, source });
    },
    [],
  );

  const requireTier = useCallback(
    (tier: RequiredTier, featureName: string, source: UpgradeSource | string) => {
      const ok = tier === "plus" ? sub.isPlus : sub.isPro;
      if (!ok) {
        trackUpgradeEvent({ event_type: "cta_click", source, tier });
        setState({ open: true, tier, feature: featureName, source });
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
        openedFrom={state.source}
      />
    </GateContext.Provider>
  );
}

export function useUpgradeGate(): GateContextValue {
  const ctx = useContext(GateContext);
  if (!ctx) throw new Error("useUpgradeGate must be used inside <UpgradeGateProvider>");
  return ctx;
}
