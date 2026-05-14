import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computePlanMetrics } from "@/lib/plan-metrics";
import { projectScenarios, investEdge } from "@/lib/invest-projection";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function pickAllocation(years: number) {
  if (years < 2) return "Almost entirely a high-yield savings account or short-term CDs. Volatility is too risky this close to your purchase.";
  if (years < 5) return "A conservative mix: ~60–70% HYSA/short-term bonds, ~30–40% diversified index funds. Smooths returns while keeping principal protected.";
  return "A growth-leaning mix: ~70–80% diversified index funds, ~20–30% HYSA/bonds. You have time to ride out volatility.";
}

export const generateInvestmentPlanPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ planId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    // Pro/Plus gate
    const { data: latestSub } = await supabaseAdmin
      .from("subscriptions")
      .select("price_id, status, current_period_end")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const priceId = (latestSub?.price_id as string | undefined) ?? "";
    const isPaid = ["plus_monthly", "plus_yearly", "pro_monthly", "pro_yearly"].includes(priceId);
    if (!isPaid) throw new Response("Plus or Pro required", { status: 403 });

    // Load the plan
    let q = supabaseAdmin
      .from("plans")
      .select("id, title, answers, assumptions, created_at")
      .eq("user_id", context.userId);
    if (data.planId) q = q.eq("id", data.planId);
    const { data: planRow } = await q
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!planRow) throw new Response("No plan found", { status: 404 });

    const metrics = computePlanMetrics(
      (planRow.answers as Record<string, unknown>) ?? {},
      (planRow.assumptions as Record<string, number>) ?? null,
    );
    const months = Math.max(1, Math.round(metrics.timelineYears * 12));
    const scenarios = projectScenarios({
      saved: metrics.saved,
      target: metrics.downPayment,
      months,
    });
    const baseline = scenarios.find((s) => s.scenario.id === "invested")!;
    const edge = investEdge({
      saved: metrics.saved,
      target: metrics.downPayment,
      monthly: baseline.monthly,
    });

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]); // letter
    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.1, 0.1, 0.1);
    const mute = rgb(0.42, 0.42, 0.42);
    const ember = rgb(0.77, 0.27, 0.18);

    const { width } = page.getSize();
    const margin = 54;
    let y = 740;

    page.drawText("KEYSTONE", { x: margin, y, font: helvBold, size: 10, color: ember });
    y -= 14;
    page.drawText("Your investment plan", { x: margin, y, font: helvBold, size: 24, color: ink });
    y -= 28;
    page.drawText(
      `Goal: ${fmt(metrics.downPayment)} down on a ${fmt(metrics.targetPrice)} ${metrics.homeStyleLabel.toLowerCase()} in ${metrics.city}`,
      { x: margin, y, font: helv, size: 11, color: mute },
    );
    y -= 14;
    page.drawText(
      `Timeline: ${metrics.timelineYears} year${metrics.timelineYears === 1 ? "" : "s"}  ·  Saved today: ${fmt(metrics.saved)}`,
      { x: margin, y, font: helv, size: 11, color: mute },
    );

    y -= 30;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, color: ink, thickness: 0.6 });
    y -= 24;

    page.drawText("Recommended monthly contribution", { x: margin, y, font: helvBold, size: 13, color: ink });
    y -= 18;

    for (const s of scenarios) {
      page.drawText(`${s.scenario.label} (${s.scenario.blurb})`, { x: margin, y, font: helvBold, size: 11, color: ink });
      page.drawText(`${fmt(s.monthly)} / mo`, { x: width - margin - 90, y, font: helvBold, size: 11, color: s.scenario.id === "invested" ? ember : ink });
      y -= 14;
      page.drawText(
        `Total contributed ${fmt(s.totalContributed)}  ·  Growth ${fmt(s.growth)}`,
        { x: margin, y, font: helv, size: 9.5, color: mute },
      );
      y -= 22;
    }

    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, color: ink, thickness: 0.4 });
    y -= 22;

    page.drawText("Why investing matters", { x: margin, y, font: helvBold, size: 13, color: ink });
    y -= 16;
    const edgeLine =
      edge.monthsSooner > 0
        ? `At ${fmt(baseline.monthly)}/mo, investing instead of using a basic savings account gets you to your down payment ${edge.monthsSooner} month${edge.monthsSooner === 1 ? "" : "s"} sooner — and your money does ${fmt(edge.dollarsSaved)} of the work for you.`
        : `Your timeline is short — focus on parking funds in a high-yield savings account.`;
    wrapText(page, edgeLine, margin, y, width - margin * 2, helv, 10.5, mute, 14);
    y -= 14 * Math.ceil(edgeLine.length / 80) + 10;

    y -= 14;
    page.drawText(`Suggested allocation for ~${metrics.timelineYears}-year timeline`, { x: margin, y, font: helvBold, size: 13, color: ink });
    y -= 16;
    const alloc = pickAllocation(metrics.timelineYears);
    wrapText(page, alloc, margin, y, width - margin * 2, helv, 10.5, mute, 14);

    // Footer disclaimer
    page.drawText(
      "Educational projection — not investment, tax, or legal advice. Returns are illustrative and not guaranteed.",
      { x: margin, y: 54, font: helv, size: 8, color: mute },
    );
    page.drawText("Generated by Keystone", { x: margin, y: 42, font: helv, size: 8, color: mute });

    const bytes = await pdf.save();
    // base64 encode for transport (TanStack server fns are JSON)
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    return { ok: true as const, base64, filename: `keystone-investment-plan.pdf` };
  });

// Minimal text wrapper for pdf-lib (no built-in word wrap)
function wrapText(
  page: import("pdf-lib").PDFPage,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  font: import("pdf-lib").PDFFont,
  size: number,
  color: import("pdf-lib").RGB,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = "";
  let y = startY;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && line) {
      page.drawText(line, { x, y, font, size, color });
      y -= lineHeight;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) page.drawText(line, { x, y, font, size, color });
}
