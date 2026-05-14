import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const joinBrokerWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ notes: z.string().trim().max(500).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await supabaseAdmin.rpc(
      "join_broker_waitlist",
      { p_notes: data.notes ?? null } as never,
    );
    if (error) {
      console.error("[joinBrokerWaitlist]", error);
      throw new Error(error.message);
    }
    const r = result as { ok: boolean; reason?: string; tier?: string; priority?: boolean };
    if (!r?.ok) {
      throw new Error(r?.reason === "requires_paid_plan" ? "Plus or Pro required" : (r?.reason ?? "failed"));
    }
    return { ok: true as const, tier: r.tier ?? null, priority: Boolean(r.priority), userId: context.userId };
  });

export const getMyWaitlistStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("broker_waitlist")
      .select("tier_at_signup, priority, created_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) {
      console.error("[getMyWaitlistStatus]", error);
      return { joined: false as const };
    }
    if (!data) return { joined: false as const };
    return {
      joined: true as const,
      tier: data.tier_at_signup as string,
      priority: Boolean(data.priority),
      createdAt: data.created_at as string,
    };
  });
