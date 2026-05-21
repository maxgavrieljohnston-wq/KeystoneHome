import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripeEnvironment } from "@/lib/stripe";

async function userHasActiveSub(userId: string, env: "sandbox" | "live") {
  const { data, error } = await supabaseAdmin.rpc("has_active_subscription", {
    user_uuid: userId,
    check_env: env,
  });
  if (error) {
    console.error("[reminders] sub check failed", error);
    return false;
  }
  return data === true;
}

const CADENCE_DAYS = 30;

export const getReminderPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("reminders_enabled, next_reminder_at, last_reminder_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      enabled: Boolean(data?.reminders_enabled),
      nextAt: (data?.next_reminder_at as string | null) ?? null,
      lastAt: (data?.last_reminder_at as string | null) ?? null,
    };
  });

export const setReminderPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const env = getStripeEnvironment();
    if (data.enabled) {
      const allowed = await userHasActiveSub(context.userId, env);
      if (!allowed) throw new Response("Upgrade required", { status: 403 });
    }

    const next = data.enabled
      ? new Date(Date.now() + CADENCE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        reminders_enabled: data.enabled,
        next_reminder_at: next,
      })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, enabled: data.enabled, nextAt: next };
  });
