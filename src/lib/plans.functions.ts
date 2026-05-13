import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  HOME_STYLES,
  styleAdjustments,
  calcMortgage,
  calcRequiredMonthly,
  rateFromCredit,
  rateAddFromDownPct,
  combinedEmploymentAdjustment,
  getPriceByZip,
} from "@/lib/keystone";

const SITE_NAME = "Keystone";
const SENDER_DOMAIN = "notify.keystonehomeowners.com";
const FROM_DOMAIN = "keystonehomeowners.com";
const SITE_URL = "https://keystonehomeowners.com";

const submitSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  answers: z.record(z.string(), z.unknown()).default({}),
  environment: z.enum(["sandbox", "live"]).default("live"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
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

async function lookupUserIdByEmail(email: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .schema("auth" as never)
      .from("users" as never)
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (error) {
      console.warn("[lookupUserIdByEmail]", error);
      return null;
    }
    return (data as { id?: string } | null)?.id ?? null;
  } catch (err) {
    console.warn("[lookupUserIdByEmail] threw", err);
    return null;
  }
}

export const submitPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    const userId = await lookupUserIdByEmail(data.email);

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      "create_plan_with_limit",
      {
        p_email: data.email,
        p_user_id: (userId ?? null) as never,
        p_answers: data.answers as never,
        p_environment: data.environment,
        p_first_name: data.firstName || null,
        p_last_name: data.lastName || null,
        p_phone: data.phone || null,
      },
    );

    if (rpcError) {
      console.error("[submitPlan] rpc failed", rpcError);
      return { ok: false as const, reason: "server_error" as const };
    }

    const result = rpcResult as unknown as {
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
          | "server_error"
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

export const getMyPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims.email as string | undefined)?.toLowerCase();

    const { data: ownedPlans } = await supabase
      .from("plans")
      .select("id, email, title, answers, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    type PlanRow = NonNullable<typeof ownedPlans>[number];
    let orphanPlans: PlanRow[] = [];
    if (email) {
      const { data } = await supabaseAdmin
        .from("plans")
        .select("id, email, title, answers, created_at")
        .ilike("email", email)
        .is("user_id", null)
        .order("created_at", { ascending: false });
      orphanPlans = (data ?? []) as PlanRow[];

      if (orphanPlans.length > 0) {
        await supabaseAdmin
          .from("plans")
          .update({ user_id: userId })
          .ilike("email", email)
          .is("user_id", null);
      }
    }

    const merged = [...(ownedPlans ?? []), ...orphanPlans].sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    );
    return { plans: merged, email: email ?? null };
  });

const planIdSchema = z.object({ planId: z.string().uuid() });

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

export const renamePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ planId: z.string().uuid(), title: z.string().trim().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("plans")
      .update({ title: data.title })
      .eq("id", data.planId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => planIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("plans")
      .delete()
      .eq("id", data.planId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const exportPlanPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        environment: z.enum(["sandbox", "live"]).default("live"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify entitlement (Plus or Pro)
    const allowed = await userHasActiveSub(context.userId, data.environment);
    if (!allowed) {
      throw new Response("Upgrade required", { status: 403 });
    }

    const { data: plan, error } = await supabaseAdmin
      .from("plans")
      .select("id, email, title, answers, created_at")
      .eq("id", data.planId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Response("Not found", { status: 404 });

    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const serif = await doc.embedFont(StandardFonts.TimesRoman);
    const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
    const mono = await doc.embedFont(StandardFonts.Courier);

    const ink = rgb(0.1, 0.1, 0.1);
    const ember = rgb(0.77, 0.27, 0.18);
    const mute = rgb(0.42, 0.42, 0.42);

    let y = 740;
    page.drawText("KEYSTONE", { x: 50, y, size: 14, font: mono, color: ink });
    y -= 30;
    page.drawText("— YOUR HOMEBUYING PLAN", {
      x: 50,
      y,
      size: 9,
      font: mono,
      color: ember,
    });
    y -= 36;
    const title = (plan.title as string | null) || "Homebuying plan";
    page.drawText(title, { x: 50, y, size: 26, font: serifBold, color: ink });
    y -= 22;
    page.drawText(`Prepared for ${plan.email}`, { x: 50, y, size: 11, font: serif, color: mute });
    y -= 14;
    page.drawText(`Generated ${new Date().toLocaleDateString()}`, {
      x: 50,
      y,
      size: 11,
      font: serif,
      color: mute,
    });
    y -= 30;
    page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, color: ink, thickness: 0.6 });
    y -= 30;

    const a = (plan.answers ?? {}) as Record<string, unknown>;
    const money = (n: unknown) =>
      typeof n === "number" ? `$${n.toLocaleString()}` : String(n ?? "—");
    const rows: Array<[string, string]> = [];
    const push = (label: string, v: unknown, fmt?: (x: unknown) => string) => {
      if (v === null || v === undefined || v === "") return;
      rows.push([label, fmt ? fmt(v) : String(v)]);
    };
    push("Name", [a.firstName, a.lastName].filter(Boolean).join(" "));
    push("ZIP", a.zip);
    push("Phone", a.phone);
    push("Annual income", a.income, money);
    push("Monthly expenses", a.expenses, money);
    push("Total debt", a.debt, money);
    push("Saved so far", a.saved, money);
    push("Credit score", a.credit);
    push("Timeline", a.timelineBucket);
    push("Down payment goal", a.downGoalPct, (v) => `${v}%`);

    for (const [k, v] of rows) {
      page.drawText(k.toUpperCase(), { x: 50, y, size: 9, font: mono, color: mute });
      page.drawText(v, { x: 280, y, size: 13, font: serif, color: ink });
      y -= 22;
      page.drawLine({
        start: { x: 50, y: y + 6 },
        end: { x: 562, y: y + 6 },
        color: rgb(0.85, 0.82, 0.75),
        thickness: 0.4,
      });
    }

    y -= 20;
    page.drawText("Keystone — your path to homeownership.", {
      x: 50,
      y,
      size: 10,
      font: serif,
      color: mute,
    });

    const bytes = await doc.save();
    // Convert to base64 for transport
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    return { ok: true as const, base64, filename: `${title.replace(/[^a-z0-9]+/gi, "-")}.pdf` };
  });

