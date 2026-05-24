import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuthReady } from "@/hooks/useAuthReady";

const PLUS_PRICES = new Set(["plus_lifetime", "plus_monthly", "plus_yearly"]);
const PRO_PRICES = new Set(["pro_monthly", "pro_yearly"]);

export type Tier = "free" | "plus" | "pro";

export interface SubscriptionState {
  tier: Tier;
  isActive: boolean;
  isPro: boolean;
  isPlus: boolean;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  priceId: string | null;
  loading: boolean;
}

export function useSubscription(): SubscriptionState {
  const { ready, user } = useAuthReady();
  const [devBypass, setDevBypass] = useState(false);

  useEffect(() => {
    const checkBypass = () => {
      setDevBypass(localStorage.getItem("dev_bypass_pro") === "true");
    };
    checkBypass();
    window.addEventListener("dev_bypass_changed", checkBypass);
    return () => window.removeEventListener("dev_bypass_changed", checkBypass);
  }, []);

  const env = getStripeEnvironment();
  const userId = user?.id ?? null;

  const fetchSub = async () => {
    if (!userId) return null;
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscription", userId, env],
    queryFn: fetchSub,
    enabled: ready && !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const name = `sub-${userId}`;
    // Defensive: remove any stale channel with the same topic (StrictMode double-invoke
    // or cached channel) before creating a new one. Adding `postgres_changes` listeners
    // after subscribe() throws.
    supabase
      .getChannels()
      .filter((c) => c.topic === `realtime:${name}`)
      .forEach((c) => {
        supabase.removeChannel(c);
      });

    const channel = supabase
      .channel(name)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  const status = (data?.status as string | null) ?? null;
  const periodEnd = (data?.current_period_end as string | null) ?? null;
  const priceId = (data?.price_id as string | null) ?? null;
  const cancelAtPeriodEnd = Boolean(data?.cancel_at_period_end);

  const periodActive = !periodEnd || new Date(periodEnd) > new Date();
  const isActive =
    !!status &&
    ((["active", "trialing", "past_due"].includes(status) && periodActive) ||
      (status === "canceled" && periodEnd !== null && periodActive));

  let tier: Tier = "free";
  if (isActive && priceId) {
    if (PRO_PRICES.has(priceId)) tier = "pro";
    else if (PLUS_PRICES.has(priceId)) tier = "plus";
  }

  if (devBypass) {
    return {
      tier: "pro",
      isActive: true,
      isPro: true,
      isPlus: true,
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      priceId: "pro_monthly",
      loading: false,
    };
  }

  return {
    tier,
    isActive,
    isPro: tier === "pro",
    isPlus: tier === "plus" || tier === "pro",
    status,
    cancelAtPeriodEnd,
    currentPeriodEnd: periodEnd,
    priceId,
    loading: !ready || isLoading,
  };
}
