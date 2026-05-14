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
    const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
    const mono = await doc.embedFont(StandardFonts.Courier);
    const monoBold = await doc.embedFont(StandardFonts.CourierBold);

    const ink = rgb(0.1, 0.1, 0.1);
    const ember = rgb(0.77, 0.27, 0.18);
    const sage = rgb(0.32, 0.5, 0.36);
    const gold = rgb(0.78, 0.6, 0.2);
    const mute = rgb(0.42, 0.42, 0.42);
    const faint = rgb(0.85, 0.82, 0.75);

    const a = (plan.answers ?? {}) as Record<string, unknown>;
    const num = (k: string, fb = 0): number => {
      const v = a[k];
      return typeof v === "number" && isFinite(v) ? v : fb;
    };
    const str = (k: string): string | null => {
      const v = a[k];
      return typeof v === "string" && v.length ? v : null;
    };
    const bool = (k: string): boolean => a[k] === true;

    const firstName = str("firstName") ?? "";
    const lastName = str("lastName") ?? "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || (plan.email as string);
    const zip = str("zip") ?? "";
    const zipDataRaw = a.zipData as { city?: string; avg?: number } | undefined;
    const zipData = zipDataRaw && typeof zipDataRaw.avg === "number"
      ? { city: zipDataRaw.city ?? "your area", avg: zipDataRaw.avg }
      : zip
        ? getPriceByZip(zip)
        : { city: "your area", avg: 400000 };

    const homeStyleId = str("homeStyle");
    const styleIds = homeStyleId ? [homeStyleId] : [];
    const styleAdj = styleAdjustments(styleIds);
    const styleName = HOME_STYLES.find((s) => s.id === homeStyleId)?.label ?? "Home";

    let mult = styleAdj.priceMult;
    mult += Math.max(0, num("beds") - 3) * 0.05;
    mult += Math.max(0, num("baths") - 2) * 0.03;
    if (str("outdoorSpace") === "patio") mult += 0.02;
    if (str("outdoorSpace") === "yard") mult += 0.05;
    if (str("parking") === "driveway") mult += 0.02;
    if (str("parking") === "garage") mult += 0.05;
    const w = (v: unknown) => (v === "must" ? 0.025 : v === "nice" ? 0.01 : 0);
    Object.values((a.lifestyle as Record<string, unknown>) ?? {}).forEach((v) => (mult += w(v)));
    Object.values((a.neighborhood as Record<string, unknown>) ?? {}).forEach((v) => (mult += w(v)));

    const targetPrice = Math.round(zipData.avg * mult);
    const downGoalPct = num("downGoalPct", 9);
    const effectiveDownPct = Math.max(downGoalPct, styleAdj.minDown);
    const downPayment = Math.round((targetPrice * effectiveDownPct) / 100);

    const hasPartner = bool("hasPartner");
    const credit = num("credit", 700);
    const partnerCredit = num("partnerCredit", credit);
    const qCredit = hasPartner ? Math.min(credit, partnerCredit) : credit;
    const empAdj = combinedEmploymentAdjustment(
      str("employment"),
      hasPartner ? str("partnerEmployment") : null,
    );
    const mortgageRate =
      rateFromCredit(qCredit) + empAdj.rateAdd + rateAddFromDownPct(effectiveDownPct);
    const mortgage = calcMortgage(targetPrice, effectiveDownPct, mortgageRate);
    const taxIns = (targetPrice * 0.018) / 12;
    const pmi =
      effectiveDownPct < 20
        ? (targetPrice * (1 - effectiveDownPct / 100) * 0.005) / 12
        : 0;
    const hoa = styleAdj.hoa;
    const reserve = styleAdj.reserve;
    const totalHousing = mortgage + taxIns + pmi + hoa + reserve;

    const income = num("income");
    const partnerIncome = num("partnerIncome");
    const expenses = num("expenses") + (hasPartner ? num("partnerExpenses") : 0);
    const debt = num("debt") + (hasPartner ? num("partnerDebt") : 0);
    const saved = num("saved");
    const combinedIncome = income + (hasPartner ? partnerIncome : 0);
    const monthlyIncome = combinedIncome / 12;
    const housingRatio = monthlyIncome > 0 ? totalHousing / monthlyIncome : 0;
    const verdict =
      housingRatio === 0
        ? "—"
        : housingRatio <= 0.45
          ? "Affordable"
          : housingRatio <= 0.55
            ? "A stretch"
            : "Difficult";
    const verdictColor = verdict === "Affordable" ? sage : verdict === "A stretch" ? gold : ember;

    const timelineYears = num("timelineYears", 3);
    const months = timelineYears * 12;
    const savedOnlyMonthly = calcRequiredMonthly(saved, downPayment, months, 0);
    const investedMonthly = calcRequiredMonthly(saved, downPayment, months, 0.07);

    const creditScoreNorm = Math.max(0, Math.min(100, ((qCredit - 580) / (820 - 580)) * 100));
    const qMonthlyIncome = monthlyIncome * empAdj.incomeFactor || 1;
    const dti = (debt + totalHousing) / qMonthlyIncome;
    const dtiScore = Math.max(0, Math.min(100, (1 - (dti - 0.45) / 0.2) * 100));
    const savingsScore = Math.max(0, Math.min(100, (saved / Math.max(downPayment, 1)) * 100));
    const timelineScore = Math.max(0, Math.min(100, (timelineYears / 5) * 100));
    const readiness = Math.round(
      creditScoreNorm * 0.3 + dtiScore * 0.3 + savingsScore * 0.25 + timelineScore * 0.15,
    );
    const readinessLabel =
      readiness >= 80 ? "Ready to act"
        : readiness >= 60 ? "Almost there"
        : readiness >= 40 ? "Building toward it"
        : "Early days";

    const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

    const W = 612;
    const M = 50;
    let y = 752;

    page.drawText("KEYSTONE", { x: M, y, size: 12, font: monoBold, color: ink });
    const headerRight = "THE REPORT";
    page.drawText(headerRight, {
      x: W - M - mono.widthOfTextAtSize(headerRight, 9),
      y: y + 2, size: 9, font: mono, color: mute,
    });
    y -= 10;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, color: ink, thickness: 0.8 });
    y -= 28;

    page.drawText("YOUR PLAN, PREPARED", { x: M, y, size: 8, font: mono, color: ember });
    y -= 22;

    const title = (plan.title as string | null) || `${styleName} in ${zipData.city}`;
    page.drawText(title, { x: M, y, size: 26, font: serifBold, color: ink });
    y -= 18;
    page.drawText(`Prepared for ${fullName}`, { x: M, y, size: 11, font: serifItalic, color: mute });
    const dateStr = `Generated ${new Date().toLocaleDateString()}`;
    page.drawText(dateStr, {
      x: W - M - serif.widthOfTextAtSize(dateStr, 11),
      y, size: 11, font: serif, color: mute,
    });
    y -= 22;

    // Headline stats
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, color: ink, thickness: 0.6 });
    const colW = (W - M * 2) / 3;
    const statY = y - 14;
    const stats: Array<[string, string]> = [
      ["EST. PRICE", money(targetPrice)],
      ["DOWN", `${effectiveDownPct}%`],
      ["= DEPOSIT", money(downPayment)],
    ];
    stats.forEach(([label, val], i) => {
      const x = M + colW * i + 8;
      page.drawText(label, { x, y: statY, size: 8, font: mono, color: mute });
      page.drawText(val, { x, y: statY - 22, size: 22, font: serifBold, color: ink });
    });
    y = statY - 36;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, color: ink, thickness: 0.6 });
    y -= 24;

    const sectionHeader = (n: string, label: string) => {
      page.drawText(n, { x: M, y, size: 8, font: mono, color: ember });
      page.drawText(label.toUpperCase(), { x: M + 22, y, size: 8, font: mono, color: ink });
      y -= 6;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, color: faint, thickness: 0.4 });
      y -= 16;
    };

    const row = (label: string, val: string, opts: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
      page.drawText(label, { x: M, y, size: 11, font: serif, color: ink });
      const f = opts.bold ? serifBold : serif;
      const valW = f.widthOfTextAtSize(val, 12);
      page.drawText(val, { x: W - M - valW, y, size: 12, font: f, color: opts.color ?? ink });
      y -= 17;
    };

    sectionHeader("01", "Monthly housing cost");
    row("Principal & interest", money(mortgage));
    row("Taxes & insurance", money(taxIns));
    if (pmi > 0) row("PMI", money(pmi));
    if (hoa > 0) row("HOA", money(hoa));
    if (reserve > 0) row("Maintenance reserve", money(reserve));
    page.drawLine({ start: { x: M, y: y + 9 }, end: { x: W - M, y: y + 9 }, color: ink, thickness: 0.4 });
    y -= 2;
    row("Total per month", money(totalHousing), { bold: true });
    row(
      `vs household income (${money(monthlyIncome)}/mo)`,
      `${Math.round(housingRatio * 100)}% — ${verdict}`,
      { color: verdictColor },
    );
    y -= 10;

    sectionHeader("02", "Path to your deposit");
    row("Already saved", money(saved));
    row(`Target deposit (${effectiveDownPct}% down)`, money(downPayment));
    row(`Save-only — ${timelineYears} yr to target`, `${money(savedOnlyMonthly)}/mo`);
    row(`Invest at moderate risk — same target`, `${money(investedMonthly)}/mo`, { color: sage });
    y -= 10;

    sectionHeader("03", "Buyer readiness");
    row("Score", `${readiness} / 100 — ${readinessLabel}`, {
      bold: true,
      color: readiness >= 60 ? sage : readiness >= 40 ? gold : ember,
    });
    row("Credit (qualifying)", String(qCredit));
    row("Debt-to-income (with new house)", `${Math.round(dti * 100)}%`);
    row("Mortgage rate (est.)", `${(mortgageRate * 100).toFixed(2)}%`);
    y -= 10;

    sectionHeader("04", "Profile snapshot");
    row("Location", `${zipData.city}${zip ? ` · ${zip}` : ""}`);
    row("Home", styleName);
    row("Household", hasPartner ? "Two-person" : "Solo");
    row("Combined income", `${money(combinedIncome)}/yr`);
    row("Monthly expenses", `${money(expenses)}/mo`);
    row("Total debt payments", `${money(debt)}/mo`);

    if (y < 60) y = 60;
    y -= 4;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, color: faint, thickness: 0.4 });
    y -= 14;
    page.drawText("Keystone — your path to homeownership.", {
      x: M, y, size: 9, font: serifItalic, color: mute,
    });
    const footRight = "keystonehomeowners.com";
    page.drawText(footRight, {
      x: W - M - mono.widthOfTextAtSize(footRight, 8),
      y, size: 8, font: mono, color: mute,
    });

    const bytes = await doc.save();
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const safeTitle = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "keystone-plan";
    return { ok: true as const, base64, filename: `${safeTitle}.pdf` };
  });

