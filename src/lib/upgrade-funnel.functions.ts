import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
});

export type FunnelRow = {
  source: string;
  tier: "plus" | "pro";
  clicks: number;
  checkout_opens: number;
  signups: number;
  click_to_paid_pct: number;
};

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const getUpgradeFunnel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const adminEmails = getAdminEmails();
    const email = (context.claims?.email as string | undefined)?.toLowerCase();
    if (adminEmails.length === 0) {
      throw new Error("Admin allowlist not configured. Set ADMIN_EMAILS.");
    }
    if (!email || !adminEmails.includes(email)) {
      throw new Error("Forbidden");
    }

    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await (supabaseAdmin as any).rpc("get_upgrade_funnel", {
      p_since: since,
    });
    if (error) throw new Error(error.message);

    const result: FunnelRow[] = (rows ?? []).map((r: any) => {
      const clicks = Number(r.clicks ?? 0);
      const signups = Number(r.signups ?? 0);
      return {
        source: r.source,
        tier: r.tier,
        clicks,
        checkout_opens: Number(r.checkout_opens ?? 0),
        signups,
        click_to_paid_pct: clicks > 0 ? Math.round((signups / clicks) * 1000) / 10 : 0,
      };
    });
    return { rows: result, since };
  });
