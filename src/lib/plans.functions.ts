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
import { buildPlanPdfBytes } from "@/lib/plan-pdf.server";

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
  pdfUrl: string | null;
}) {
  const remaining =
    !opts.isPaid && opts.limit != null && opts.used != null
      ? Math.max(opts.limit - opts.used, 0)
      : null;
  const remainingLine =
    remaining != null
      ? `<p style="margin:0 0 14px;color:#3d3d3d;font-size:14px;line-height:1.5">You have <strong>${remaining}</strong> free plan${remaining === 1 ? "" : "s"} remaining.</p>`
      : `<p style="margin:0 0 14px;color:#3d3d3d;font-size:14px;line-height:1.5">Thanks for being a paid member — create as many plans as you like.</p>`;

  const pdfButton = opts.pdfUrl
    ? `<p style="margin:0 0 18px"><a href="${opts.pdfUrl}" style="display:inline-block;background:#c4452d;color:#ffffff;padding:14px 22px;border-radius:8px;text-decoration:none;font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:0.12em;text-transform:uppercase">↓ Download your plan (PDF)</a></p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Georgia,serif;color:#1a1a1a">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#c4452d;margin-bottom:18px">— Your plan is ready</div>
    <h1 style="font-weight:400;font-size:32px;line-height:1.1;letter-spacing:-0.02em;margin:0 0 16px">Your Keystone homebuying plan</h1>
    <p style="margin:0 0 18px;color:#3d3d3d;font-size:16px;line-height:1.5">Here's your personalised plan — a one-page PDF you can save, share, or bring to a lender.</p>
    ${pdfButton}
    <p style="margin:0 0 14px;color:#3d3d3d;font-size:14px;line-height:1.5">We've also saved it to <strong>${opts.email}</strong> so you can sign in and revisit any time.</p>
    ${remainingLine}
    <p style="margin:24px 0 0">
      <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#1a1a1a;color:#f5efe6;padding:14px 22px;border-radius:8px;text-decoration:none;font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:0.12em;text-transform:uppercase">View your plan</a>
    </p>
    <p style="margin:32px 0 0;color:#a39888;font-size:12px;line-height:1.5">Keystone — your path to homeownership.</p>
  </div></body></html>`;

  const text = `Your Keystone homebuying plan\n\nWe've saved your plan to ${opts.email}. View it any time at ${SITE_URL}/dashboard${
    opts.pdfUrl ? `\n\nDownload your PDF: ${opts.pdfUrl}` : ""
  }\n\n${
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

    // Generate a one-click PDF download token for the welcome email
    let pdfUrl: string | null = null;
    if (result.plan_id) {
      try {
        const { nanoid } = await import("nanoid");
        const token = nanoid(24);
        const { error: tokErr } = await supabaseAdmin
          .from("plans")
          .update({ pdf_token: token } as never)
          .eq("id", result.plan_id);
        if (tokErr) {
          console.error("[submitPlan] pdf_token update failed", tokErr);
        } else {
          pdfUrl = `${SITE_URL}/api/public/plans/pdf?token=${token}`;
        }
      } catch (err) {
        console.error("[submitPlan] pdf token generation threw", err);
      }
    }

    // Enqueue plan summary email (fire-and-forget; failure shouldn't gate UX)
    try {
      const { html, text } = renderPlanEmail({
        email: data.email,
        used: result.used ?? null,
        limit: result.limit ?? null,
        isPaid: Boolean(result.is_paid),
        pdfUrl,
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

    const PLAN_COLS = "id, email, title, answers, created_at, tags, notes, share_slug, share_enabled, assumptions, target_move_in, current_savings, theme, parent_plan_id, version";
    const { data: ownedPlans } = await supabase
      .from("plans")
      .select(PLAN_COLS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    type PlanRow = NonNullable<typeof ownedPlans>[number];
    let orphanPlans: PlanRow[] = [];
    if (email) {
      const { data } = await supabaseAdmin
        .from("plans")
        .select(PLAN_COLS)
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

export const duplicatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => planIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: src, error: srcErr } = await supabaseAdmin
      .from("plans")
      .select("id, email, title, answers, tags, notes, assumptions, target_move_in, current_savings, theme, parent_plan_id, version")
      .eq("id", data.planId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (srcErr) throw new Error(srcErr.message);
    if (!src) throw new Response("Not found", { status: 404 });

    const rootId = src.parent_plan_id ?? src.id;

    const { data: family } = await supabaseAdmin
      .from("plans")
      .select("version")
      .or(`id.eq.${rootId},parent_plan_id.eq.${rootId}`)
      .eq("user_id", context.userId);
    const maxVersion = (family ?? []).reduce(
      (m: number, r: { version: number | null }) => Math.max(m, r.version ?? 1),
      1,
    );

    const { data: created, error: insErr } = await supabaseAdmin
      .from("plans")
      .insert({
        email: src.email,
        user_id: context.userId,
        answers: src.answers,
        title: src.title,
        tags: src.tags ?? [],
        notes: src.notes,
        assumptions: src.assumptions ?? {},
        target_move_in: src.target_move_in,
        current_savings: src.current_savings,
        theme: src.theme ?? "light",
        parent_plan_id: rootId,
        version: maxVersion + 1,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    return { ok: true as const, planId: created.id };
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

    const { bytes, filename } = await buildPlanPdfBytes({
      id: plan.id as string,
      email: plan.email as string,
      title: plan.title as string | null,
      answers: (plan.answers ?? {}) as Record<string, unknown>,
      created_at: plan.created_at as string | null,
    });
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    return { ok: true as const, base64, filename };
  });


// ── Plus tier feature server functions ────────────────────────────────────

const assumptionsSchema = z.object({
  propertyTaxPct: z.number().min(0).max(10).optional(),
  insuranceAnnual: z.number().min(0).max(50000).optional(),
  hoaMonthly: z.number().min(0).max(5000).optional(),
  mortgageRatePct: z.number().min(0).max(20).optional(),
  pmiPct: z.number().min(0).max(5).optional(),
  expectedReturnPct: z.number().min(0).max(30).optional(),
  closingCostPct: z.number().min(0).max(10).optional(),
  movingCost: z.number().min(0).max(50000).optional(),
}).strict();

const updateMetaSchema = z.object({
  planId: z.string().uuid(),
  title: z.string().trim().min(1).max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  notes: z.string().max(2000).nullable().optional(),
  theme: z.enum(["light", "dark", "sepia"]).optional(),
  targetMoveIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  currentSavings: z.number().min(0).max(1e9).nullable().optional(),
  assumptions: assumptionsSchema.optional(),
  environment: z.enum(["sandbox", "live"]).default("live"),
});

export const updatePlanMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateMetaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const allowed = await userHasActiveSub(context.userId, data.environment);
    if (!allowed) throw new Response("Upgrade required", { status: 403 });

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.tags !== undefined) patch.tags = data.tags;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.theme !== undefined) patch.theme = data.theme;
    if (data.targetMoveIn !== undefined) patch.target_move_in = data.targetMoveIn;
    if (data.currentSavings !== undefined) patch.current_savings = data.currentSavings;
    if (data.assumptions !== undefined) patch.assumptions = data.assumptions;

    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { error } = await supabaseAdmin
      .from("plans")
      .update(patch as never)
      .eq("id", data.planId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const togglePlanShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      planId: z.string().uuid(),
      enabled: z.boolean(),
      environment: z.enum(["sandbox", "live"]).default("live"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const allowed = await userHasActiveSub(context.userId, data.environment);
    if (!allowed) throw new Response("Upgrade required", { status: 403 });

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("plans")
      .select("share_slug")
      .eq("id", data.planId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing) throw new Response("Not found", { status: 404 });

    let slug = (existing as { share_slug: string | null }).share_slug;
    if (data.enabled && !slug) {
      const { nanoid } = await import("nanoid");
      slug = nanoid(10);
    }

    const { error } = await supabaseAdmin
      .from("plans")
      .update({ share_enabled: data.enabled, share_slug: slug })
      .eq("id", data.planId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, slug: data.enabled ? slug : null };
  });

export const getSharedPlan = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(4).max(40) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: plan, error } = await supabaseAdmin
      .from("plans")
      .select("id, title, answers, created_at, theme, assumptions, target_move_in, current_savings, share_enabled")
      .eq("share_slug", data.slug)
      .eq("share_enabled", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Response("Not found", { status: 404 });
    return { plan };
  });

export const exportPlanCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      planId: z.string().uuid(),
      environment: z.enum(["sandbox", "live"]).default("live"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const allowed = await userHasActiveSub(context.userId, data.environment);
    if (!allowed) throw new Response("Upgrade required", { status: 403 });

    const { data: plan, error } = await supabaseAdmin
      .from("plans")
      .select("id, email, title, answers, created_at, assumptions")
      .eq("id", data.planId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Response("Not found", { status: 404 });

    const a = (plan.answers ?? {}) as Record<string, unknown>;
    const ov = (plan.assumptions ?? {}) as Record<string, number>;
    const num = (k: string, fb = 0) =>
      typeof a[k] === "number" && isFinite(a[k] as number) ? (a[k] as number) : fb;
    const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : null);
    const bool = (k: string) => a[k] === true;

    const zip = str("zip") ?? "";
    const zipDataRaw = a.zipData as { city?: string; avg?: number } | undefined;
    const zipData = zipDataRaw?.avg
      ? { city: zipDataRaw.city ?? "your area", avg: zipDataRaw.avg }
      : zip ? getPriceByZip(zip) : { city: "your area", avg: 400000 };

    const styleId = str("homeStyle");
    const styleAdj = styleAdjustments(styleId ? [styleId] : []);
    let mult = styleAdj.priceMult;
    mult += Math.max(0, num("beds") - 3) * 0.05;
    mult += Math.max(0, num("baths") - 2) * 0.03;
    const targetPrice = Math.round(zipData.avg * mult);
    const downGoalPct = num("downGoalPct", 9);
    const effectiveDownPct = Math.max(downGoalPct, styleAdj.minDown);
    const downPayment = Math.round((targetPrice * effectiveDownPct) / 100);

    const credit = num("credit", 700);
    const partnerCredit = num("partnerCredit", credit);
    const hasPartner = bool("hasPartner");
    const qCredit = hasPartner ? Math.min(credit, partnerCredit) : credit;
    const empAdj = combinedEmploymentAdjustment(
      str("employment"),
      hasPartner ? str("partnerEmployment") : null,
    );
    const baseRate = rateFromCredit(qCredit) + empAdj.rateAdd + rateAddFromDownPct(effectiveDownPct);
    const mortgageRate = ov.mortgageRatePct != null ? ov.mortgageRatePct / 100 : baseRate;
    const mortgage = calcMortgage(targetPrice, effectiveDownPct, mortgageRate);
    const taxIns = ov.propertyTaxPct != null
      ? (targetPrice * ov.propertyTaxPct / 100) / 12 + (ov.insuranceAnnual ?? 1500) / 12
      : (targetPrice * 0.018) / 12;
    const pmi = effectiveDownPct < 20
      ? (targetPrice * (1 - effectiveDownPct / 100) * (ov.pmiPct ?? 0.5) / 100) / 12
      : 0;
    const hoa = ov.hoaMonthly ?? styleAdj.hoa;
    const totalHousing = mortgage + taxIns + pmi + hoa + styleAdj.reserve;

    const closingPct = ov.closingCostPct ?? 3;
    const closing = Math.round(targetPrice * closingPct / 100);
    const moving = ov.movingCost ?? 1500;
    const totalCash = downPayment + closing + moving;

    const saved = num("saved");
    const timelineYears = num("timelineYears", 3);
    const months = timelineYears * 12;
    const returnRate = ov.expectedReturnPct != null ? ov.expectedReturnPct / 100 : 0.07;
    const savedOnly = calcRequiredMonthly(saved, downPayment, months, 0);
    const invested = calcRequiredMonthly(saved, downPayment, months, returnRate);

    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: Array<[string, string | number]> = [
      ["Plan", plan.title || "Homebuying plan"],
      ["Generated", new Date().toISOString()],
      ["Location", zipData.city],
      ["Target price", targetPrice],
      ["Down payment %", effectiveDownPct],
      ["Down payment $", downPayment],
      ["Closing costs", closing],
      ["Moving costs", moving],
      ["TOTAL CASH TO CLOSE", totalCash],
      ["Mortgage rate %", +(mortgageRate * 100).toFixed(3)],
      ["Monthly P&I", Math.round(mortgage)],
      ["Tax + insurance", Math.round(taxIns)],
      ["PMI", Math.round(pmi)],
      ["HOA", Math.round(hoa)],
      ["Reserve", styleAdj.reserve],
      ["TOTAL MONTHLY", Math.round(totalHousing)],
      ["Saved so far", saved],
      ["Timeline (months)", months],
      ["Save-only $/mo", savedOnly],
      [`Invested @ ${(returnRate * 100).toFixed(1)}% $/mo`, invested],
    ];
    const csv = "Field,Value\n" + rows.map(([k, v]) => `${esc(k)},${esc(v)}`).join("\n");
    const safeTitle = (plan.title || "keystone-plan").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return { ok: true as const, csv, filename: `${safeTitle}.csv` };
  });
