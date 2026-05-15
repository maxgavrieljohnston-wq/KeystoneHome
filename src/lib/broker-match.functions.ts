import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const REQUEST_SCHEMA = z.object({
  serviceType: z.enum(["mortgage", "realtor", "both"]),
  planId: z.string().uuid().nullable().optional(),
  targetCity: z.string().trim().max(120).optional().nullable(),
  targetState: z.string().trim().max(2).optional().nullable(),
  targetZip: z.string().trim().max(10).optional().nullable(),
  priceMin: z.number().finite().min(0).max(100_000_000).optional().nullable(),
  priceMax: z.number().finite().min(0).max(100_000_000).optional().nullable(),
  timeline: z.enum(["0-3m", "3-6m", "6-12m", "12m+"]).optional().nullable(),
  loanType: z.enum(["conventional", "fha", "va", "usda", "jumbo", "unsure"]).optional().nullable(),
  creditBand: z.enum(["740+", "700-739", "660-699", "620-659", "<620", "unsure"]).optional().nullable(),
  firstTimeBuyer: z.boolean().optional().nullable(),
  buyerOrSeller: z.enum(["buyer", "seller", "both"]).optional().nullable(),
  propertyType: z.enum(["single-family", "condo", "townhome", "multi-family", "other"]).optional().nullable(),
  preferredLanguage: z.string().trim().max(40).optional().nullable(),
  contactMethod: z.enum(["email", "phone", "text"]).optional().nullable(),
  contactTime: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

async function getTier(userId: string): Promise<{ tier: "free" | "plus" | "pro"; priority: boolean }> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("price_id,status,current_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const active =
    data &&
    ((["active", "trialing"].includes(data.status) &&
      (!data.current_period_end || new Date(data.current_period_end) > new Date())) ||
      (data.status === "canceled" && data.current_period_end && new Date(data.current_period_end) > new Date()));
  if (!active) return { tier: "free", priority: false };
  const pid = data?.price_id ?? "";
  if (pid.startsWith("pro_")) return { tier: "pro", priority: true };
  if (pid.startsWith("plus_")) return { tier: "plus", priority: false };
  return { tier: "free", priority: false };
}

export const submitBrokerMatchRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => REQUEST_SCHEMA.parse(input))
  .handler(async ({ data, context }) => {
    const { tier, priority } = await getTier(context.userId);
    if (tier === "free") {
      throw new Error("Plus or Pro required");
    }
    if (data.priceMin != null && data.priceMax != null && data.priceMin > data.priceMax) {
      throw new Error("Min price cannot exceed max price");
    }

    const { data: row, error } = await supabaseAdmin
      .from("broker_match_requests")
      .insert({
        user_id: context.userId,
        plan_id: data.planId ?? null,
        service_type: data.serviceType,
        target_city: data.targetCity ?? null,
        target_state: data.targetState?.toUpperCase() ?? null,
        target_zip: data.targetZip ?? null,
        price_min: data.priceMin ?? null,
        price_max: data.priceMax ?? null,
        timeline: data.timeline ?? null,
        loan_type: data.loanType ?? null,
        credit_band: data.creditBand ?? null,
        first_time_buyer: data.firstTimeBuyer ?? false,
        buyer_or_seller: data.buyerOrSeller ?? null,
        property_type: data.propertyType ?? null,
        preferred_language: data.preferredLanguage ?? null,
        contact_method: data.contactMethod ?? null,
        contact_time: data.contactTime ?? null,
        notes: data.notes ?? null,
        tier_at_signup: tier,
        priority,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("[submitBrokerMatchRequest]", error);
      throw new Error(error.message);
    }

    // Notify ops via existing email queue (best-effort).
    try {
      await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional",
        payload: {
          template: "broker_match_request_admin",
          to: "ops@keystonehomeowner.app",
          data: {
            request_id: row.id,
            user_id: context.userId,
            tier,
            priority,
            service_type: data.serviceType,
            city: data.targetCity,
            state: data.targetState,
          },
        } as never,
      } as never);
    } catch (err) {
      console.warn("[submitBrokerMatchRequest] enqueue notify failed", err);
    }

    return { ok: true as const, id: row.id, tier, priority };
  });

export const getMyBrokerMatchRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("broker_match_requests")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[getMyBrokerMatchRequests]", error);
      return { requests: [] };
    }
    return { requests: data ?? [] };
  });

export const cancelBrokerMatchRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("broker_match_requests")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
