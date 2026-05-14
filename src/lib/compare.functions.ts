import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function userHasActiveSub(userId: string, env: "sandbox" | "live") {
  const { data, error } = await supabaseAdmin.rpc("has_active_subscription", {
    user_uuid: userId,
    check_env: env,
  } as never);
  if (error) {
    console.warn("[has_active_subscription]", error);
    return false;
  }
  return Boolean(data);
}

async function userIsPro(userId: string, env: "sandbox" | "live"): Promise<boolean> {
  const allowed = await userHasActiveSub(userId, env);
  if (!allowed) return false;
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("price_id")
    .eq("user_id", userId)
    .eq("environment", env)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const priceId = (data?.price_id as string | undefined) ?? "";
  return priceId === "pro_monthly" || priceId === "pro_yearly";
}

export const getComparePlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        planIds: z.array(z.string().uuid()).min(2).max(3),
        environment: z.enum(["sandbox", "live"]).default("live"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const isPro = await userIsPro(context.userId, data.environment);
    if (!isPro) throw new Response("Pro plan required", { status: 403 });

    const { data: rows, error } = await supabaseAdmin
      .from("plans")
      .select("id, title, answers, version, created_at, assumptions")
      .eq("user_id", context.userId)
      .in("id", data.planIds);
    if (error) throw new Error(error.message);

    return { plans: rows ?? [] };
  });
