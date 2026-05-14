import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function userIsPro(userId: string, env: "sandbox" | "live"): Promise<boolean> {
  const { data: allowed } = await supabaseAdmin.rpc("has_active_subscription", {
    user_uuid: userId,
    check_env: env,
  } as never);
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

/**
 * Indicative national 30-yr fixed rate. In a future iteration, swap for a
 * real source (Freddie Mac PMMS, FRED MORTGAGE30US). Kept as a single helper
 * so callers and any future cron job stay in sync.
 */
export function currentMortgageRate(): number {
  return 0.0685;
}

export const getRateAlert = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("rate_alerts")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { alert: data, currentRate: currentMortgageRate() };
  });

export const upsertRateAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        targetRate: z.number().min(0.01).max(0.25),
        loanAmount: z.number().min(0).max(50_000_000),
        active: z.boolean().default(true),
        emailNotifications: z.boolean().default(true),
        environment: z.enum(["sandbox", "live"]).default("live"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const isPro = await userIsPro(context.userId, data.environment);
    if (!isPro) throw new Response("Pro plan required", { status: 403 });

    const { error } = await supabaseAdmin.from("rate_alerts").upsert(
      {
        user_id: context.userId,
        target_rate: data.targetRate,
        loan_amount: data.loanAmount,
        active: data.active,
        email_notifications: data.emailNotifications,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteRateAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("rate_alerts")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
