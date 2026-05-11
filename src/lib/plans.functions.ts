import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SITE_NAME = "Keystone";
const SENDER_DOMAIN = "notify.keystonehomeowners.com";
const FROM_DOMAIN = "keystonehomeowners.com";
const SITE_URL = "https://keystonehomeowners.com";

const submitSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  answers: z.record(z.string(), z.unknown()).default({}),
  environment: z.enum(["sandbox", "live"]).default("live"),
});

function renderPlanEmail(opts: {
  email: string;
  used: number | null;
  limit: number | null;
  isPaid: boolean;
}) {
  const remaining =
    !opts.isPaid && opts.limit != null && opts.used != null
      ? Math.max(opts.limit - opts.used, 0)
      : null;
  const remainingLine =
    remaining != null
      ? `<p style="margin:0 0 14px;color:#3d3d3d;font-size:14px;line-height:1.5">You have <strong>${remaining}</strong> free plan${remaining === 1 ? "" : "s"} remaining.</p>`
      : `<p style="margin:0 0 14px;color:#3d3d3d;font-size:14px;line-height:1.5">Thanks for being a paid member — create as many plans as you like.</p>`;

  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Georgia,serif;color:#1a1a1a">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#c4452d;margin-bottom:18px">— Your plan is ready</div>
    <h1 style="font-weight:400;font-size:32px;line-height:1.1;letter-spacing:-0.02em;margin:0 0 16px">Your Keystone homebuying plan</h1>
    <p style="margin:0 0 18px;color:#3d3d3d;font-size:16px;line-height:1.5">We've saved your plan to <strong>${opts.email}</strong>. Sign in any time to view it again.</p>
    ${remainingLine}
    <p style="margin:24px 0 0">
      <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#1a1a1a;color:#f5efe6;padding:14px 22px;border-radius:8px;text-decoration:none;font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:0.12em;text-transform:uppercase">View your plan</a>
    </p>
    <p style="margin:32px 0 0;color:#a39888;font-size:12px;line-height:1.5">Keystone — your path to homeownership.</p>
  </div></body></html>`;

  const text = `Your Keystone homebuying plan\n\nWe've saved your plan to ${opts.email}. View it any time at ${SITE_URL}/dashboard\n\n${
    remaining != null
      ? `You have ${remaining} free plan${remaining === 1 ? "" : "s"} remaining.`
      : "Thanks for being a paid member — create as many plans as you like."
  }`;
  return { html, text };
}

export const submitPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    // Look up an existing user with this email so we can attach user_id
    // (for RLS-visible "my plans") and check subs by user as well as email.
    let userId: string | null = null;
    try {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });
      // listUsers doesn't filter; do a direct query instead
      const { data: u } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .limit(1)
        .maybeSingle();
      void list;
      void u;
    } catch {
      // ignore
    }
    // More reliable: query auth.users via admin
    try {
      const { data: row } = await supabaseAdmin
        .schema("auth" as never)
        .from("users" as never)
        .select("id")
        .eq("email", data.email)
        .maybeSingle();
      if (row && (row as { id?: string }).id) {
        userId = (row as { id: string }).id;
      }
    } catch (err) {
      console.warn("[submitPlan] auth.users lookup failed", err);
    }

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      "create_plan_with_limit",
      {
        p_email: data.email,
        p_user_id: userId,
        p_answers: data.answers as never,
        p_environment: data.environment,
      },
    );

    if (rpcError) {
      console.error("[submitPlan] rpc failed", rpcError);
      return { ok: false as const, reason: "server_error" as const };
    }

    const result = rpcResult as {
      ok: boolean;
      reason?: string;
      plan_id?: string;
      used?: number;
      limit?: number | null;
      is_paid?: boolean;
    };

    if (!result.ok) {
      return {
        ok: false as const,
        reason: (result.reason ?? "unknown") as
          | "limit_reached"
          | "invalid_email"
          | "unknown",
        used: result.used ?? null,
        limit: result.limit ?? null,
      };
    }

    // Enqueue plan summary email (fire-and-forget; failure shouldn't gate UX)
    try {
      const { html, text } = renderPlanEmail({
        email: data.email,
        used: result.used ?? null,
        limit: result.limit ?? null,
        isPaid: Boolean(result.is_paid),
      });
      const messageId = crypto.randomUUID();

      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "plan_summary",
        recipient_email: data.email,
        status: "pending",
      });

      const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to: data.email,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: "Your Keystone homebuying plan",
          html,
          text,
          purpose: "transactional",
          label: "plan_summary",
          queued_at: new Date().toISOString(),
        } as never,
      });
      if (enqueueError) {
        console.error("[submitPlan] enqueue failed", enqueueError);
      }
    } catch (err) {
      console.error("[submitPlan] email render/enqueue threw", err);
    }

    return {
      ok: true as const,
      planId: result.plan_id ?? null,
      used: result.used ?? null,
      limit: result.limit ?? null,
      isPaid: Boolean(result.is_paid),
    };
  });

export const getMyPlans = createServerFn({ method: "GET" }).handler(async () => {
  // Reads via service role; we filter by the requesting user's email below.
  // But this server fn has no auth context — instead we expose an authed variant:
  return { ok: true as const };
});
