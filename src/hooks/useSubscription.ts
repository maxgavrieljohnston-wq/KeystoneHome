import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

const PLUS_PRICES = new Set(["plus_monthly", "plus_yearly"]);
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
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const env = getPaddleEnvironment();

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
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`sub-${userId}`)
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

  return {
    tier,
    isActive,
    isPro: tier === "pro",
    isPlus: tier === "plus" || tier === "pro",
    status,
    cancelAtPeriodEnd,
    currentPeriodEnd: periodEnd,
    priceId,
    loading: isLoading,
  };
}
