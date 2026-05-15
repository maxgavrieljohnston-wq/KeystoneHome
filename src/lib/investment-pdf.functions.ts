import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type RGB } from "pdf-lib";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computePlanMetrics } from "@/lib/plan-metrics";
import {
  projectScenarios,
  futureValue,
  monthsToGoal,
  investEdge,
  SCENARIOS,
} from "@/lib/invest-projection";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);

// Brand palette (mirrors src/styles.css ember + ink)
const EMBER = rgb(0.91, 0.36, 0.23);
const INK = rgb(0.10, 0.10, 0.10);
const MUTE = rgb(0.42, 0.42, 0.42);
const FAINT = rgb(0.78, 0.78, 0.78);
const PAPER = rgb(0.98, 0.97, 0.94);
const SAGE = rgb(0.36, 0.55, 0.42);
const AMBER = rgb(0.71, 0.54, 0.16);

// Per-scenario chart color
const SCENARIO_COLOR: Record<string, RGB> = {
  savings: rgb(0.55, 0.55, 0.55),
  hysa: rgb(0.27, 0.51, 0.71),
  blended: rgb(0.55, 0.40, 0.65),
  invested: EMBER,
};

type RiskBand = {
  level: "high" | "medium" | "low";
  label: string;
  body: string;
  color: RGB;
};

function riskBandForYears(years: number): RiskBand {
  if (years < 3) {
    return {
      level: "high",
      label: "Short timeline — market risk",
      body: "With less than 3 years to your purchase, a downturn could leave you short. Most planners suggest sticking with HYSA or a blended mix for short horizons.",
      color: EMBER,
    };
  }
  if (years < 5) {
    return {
      level: "medium",
      label: "Medium timeline — consider blended",
      body: "3 to 5 years is the gray zone. A blended (50/50 HYSA + invested) approach captures some upside while limiting downside risk.",
      color: AMBER,
    };
  }
  return {
    level: "low",
    label: "Long timeline — invested makes sense",
    body: "5+ years gives the market time to recover from downturns. Investing historically beats saving meaningfully over this horizon.",
    color: SAGE,
  };
}

function suggestedScenarioId(years: number): "hysa" | "blended" | "invested" {
  if (years < 3) return "hysa";
  if (years < 5) return "blended";
  return "invested";
}

function pickAllocation(years: number) {
  if (years < 2) return "Almost entirely a high-yield savings account or short-term CDs. Volatility is too risky this close to your purchase.";
  if (years < 5) return "A conservative mix: ~60–70% HYSA/short-term bonds, ~30–40% diversified index funds. Smooths returns while keeping principal protected.";
  return "A growth-leaning mix: ~70–80% diversified index funds, ~20–30% HYSA/bonds. You have time to ride out volatility.";
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "plan";
}

function todayStamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function todayHuman() {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
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

    // Profile (display name)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    const rawName = (profile?.display_name as string | undefined) ?? "";
    // Display names may be emails — strip the @-suffix for the header
    const displayName = rawName.includes("@") ? rawName.split("@")[0] : rawName;

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

    const answers = (planRow.answers as Record<string, unknown>) ?? {};
    const assumptions = (planRow.assumptions as Record<string, number>) ?? null;
    const planTitle = (planRow.title as string | undefined)?.trim() || "My homebuying plan";

    const metrics = computePlanMetrics(answers, assumptions);
    const baseMonths = Math.max(1, Math.round(metrics.timelineYears * 12));
    const scenarios = projectScenarios({
      saved: metrics.saved,
      target: metrics.downPayment,
      months: baseMonths,
    });
    const investedBaseline = scenarios.find((s) => s.scenario.id === "invested")!;
    const suggestedId = suggestedScenarioId(metrics.timelineYears);

    // User's chosen monthly (from the Accelerator slider) or invested baseline.
    const persistedMonthly = (assumptions?.investMonthly as number | undefined) ?? null;
    const chosenMonthly = Math.max(0, Math.round(persistedMonthly ?? investedBaseline.monthly));
    const chosenScenarioId = persistedMonthly != null ? suggestedId : "invested";
    const chosenScenario = SCENARIOS.find((s) => s.id === chosenScenarioId)!;
    const chosenMonths = monthsToGoal(metrics.saved, metrics.downPayment, chosenMonthly, chosenScenario.rate);
    const chosenMonthsCapped = isFinite(chosenMonths) ? chosenMonths : baseMonths * 4;

    const edge = investEdge({
      saved: metrics.saved,
      target: metrics.downPayment,
      monthly: chosenMonthly,
    });

    // ============ Build PDF ============
    const pdf = await PDFDocument.create();
    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const PAGE_W = 612;
    const PAGE_H = 792;
    const MARGIN = 54;
    const MAX_W = PAGE_W - MARGIN * 2;

    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H;

    const addPage = () => {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      drawFooter(page, helv);
    };

    const ensure = (needed: number) => {
      if (y - needed < MARGIN + 28) addPage();
    };

    // Header band
    page.drawRectangle({ x: 0, y: PAGE_H - 86, width: PAGE_W, height: 86, color: PAPER });
    page.drawRectangle({ x: 0, y: PAGE_H - 90, width: PAGE_W, height: 4, color: EMBER });
    page.drawText("KEYSTONE", { x: MARGIN, y: PAGE_H - 38, font: helvBold, size: 11, color: EMBER });
    page.drawText("Your investment plan", { x: MARGIN, y: PAGE_H - 64, font: helvBold, size: 22, color: INK });
    const stampLine = `${displayName ? `Prepared for ${displayName} · ` : ""}${todayHuman()}`;
    page.drawText(stampLine, {
      x: PAGE_W - MARGIN - helv.widthOfTextAtSize(stampLine, 9),
      y: PAGE_H - 38,
      font: helv,
      size: 9,
      color: MUTE,
    });
    drawFooter(page, helv);
    y = PAGE_H - 110;

    // Plan title + goal
    page.drawText(planTitle, { x: MARGIN, y, font: helvBold, size: 14, color: INK });
    y -= 18;
    page.drawText(
      `Goal: ${fmt(metrics.downPayment)} down on a ${fmt(metrics.targetPrice)} ${metrics.homeStyleLabel.toLowerCase()} in ${metrics.city}`,
      { x: MARGIN, y, font: helv, size: 10.5, color: MUTE },
    );
    y -= 14;
    page.drawText(
      `Timeline: ${metrics.timelineYears} year${metrics.timelineYears === 1 ? "" : "s"}  ·  Saved today: ${fmt(metrics.saved)}`,
      { x: MARGIN, y, font: helv, size: 10.5, color: MUTE },
    );
    y -= 22;
    drawHr(page, MARGIN, y, MAX_W, FAINT);
    y -= 22;

    // ===== Your plan card =====
    page.drawText("YOUR PLAN", { x: MARGIN, y, font: helvBold, size: 9, color: EMBER });
    y -= 16;
    const cardTop = y;
    const cardH = 76;
    page.drawRectangle({ x: MARGIN, y: cardTop - cardH, width: MAX_W, height: cardH, color: PAPER });
    page.drawRectangle({ x: MARGIN, y: cardTop - cardH, width: 4, height: cardH, color: EMBER });

    page.drawText(`${fmt(chosenMonthly)} / month`, {
      x: MARGIN + 18, y: cardTop - 22, font: helvBold, size: 18, color: INK,
    });
    page.drawText(
      `into ${chosenScenario.label.toLowerCase()} (${chosenScenario.blurb})`,
      { x: MARGIN + 18, y: cardTop - 38, font: helv, size: 10, color: MUTE },
    );
    const yearsToGoal = chosenMonthsCapped / 12;
    page.drawText(
      `Reaches ${fmt(metrics.downPayment)} in ~${yearsToGoal.toFixed(1)} year${yearsToGoal === 1 ? "" : "s"}`,
      { x: MARGIN + 18, y: cardTop - 54, font: helv, size: 10, color: INK },
    );
    if (edge.monthsSooner > 0) {
      page.drawText(
        `vs basic savings: ${edge.monthsSooner} mo sooner · ${fmt(edge.dollarsSaved)} less from your pocket`,
        { x: MARGIN + 18, y: cardTop - 68, font: helv, size: 9, color: MUTE },
      );
    }
    y = cardTop - cardH - 22;

    // ===== Risk band =====
    const risk = riskBandForYears(metrics.timelineYears);
    ensure(60);
    page.drawRectangle({ x: MARGIN, y: y - 4, width: 3, height: 50, color: risk.color });
    page.drawText(risk.label.toUpperCase(), { x: MARGIN + 12, y: y + 32, font: helvBold, size: 9, color: risk.color });
    const riskLines = wrap(risk.body, helv, 10, MAX_W - 18);
    let ry = y + 18;
    for (const ln of riskLines) {
      page.drawText(ln, { x: MARGIN + 12, y: ry, font: helv, size: 10, color: INK });
      ry -= 13;
    }
    y -= 60 + Math.max(0, (riskLines.length - 2) * 13);

    // ===== Growth chart =====
    ensure(220);
    page.drawText("Projected balance over time", { x: MARGIN, y, font: helvBold, size: 12, color: INK });
    y -= 14;
    const chartH = 160;
    const chartTop = y;
    const chartBottom = y - chartH;
    drawGrowthChart(page, helv, helvBold, {
      x: MARGIN,
      y: chartBottom,
      w: MAX_W,
      h: chartH,
      saved: metrics.saved,
      target: metrics.downPayment,
      months: baseMonths,
    });
    y = chartBottom - 14;

    // Legend
    let lx = MARGIN;
    for (const s of SCENARIOS) {
      const c = SCENARIO_COLOR[s.id];
      page.drawRectangle({ x: lx, y: y - 1, width: 10, height: 3, color: c });
      page.drawText(s.label, { x: lx + 14, y: y - 4, font: helv, size: 9, color: INK });
      lx += helv.widthOfTextAtSize(s.label, 9) + 32;
    }
    page.drawText("Goal", {
      x: PAGE_W - MARGIN - helv.widthOfTextAtSize("Goal — — —", 9),
      y: y - 4,
      font: helv, size: 9, color: MUTE,
    });
    y -= 24;

    // ===== Scenario comparison rows =====
    ensure(80);
    page.drawText("All four approaches at your timeline", { x: MARGIN, y, font: helvBold, size: 12, color: INK });
    y -= 16;
    page.drawText("Scenario", { x: MARGIN, y, font: helvBold, size: 8.5, color: MUTE });
    page.drawText("Monthly", { x: MARGIN + 230, y, font: helvBold, size: 8.5, color: MUTE });
    page.drawText("Total in", { x: MARGIN + 320, y, font: helvBold, size: 8.5, color: MUTE });
    page.drawText("Growth", { x: MARGIN + 410, y, font: helvBold, size: 8.5, color: MUTE });
    y -= 4;
    drawHr(page, MARGIN, y, MAX_W, FAINT);
    y -= 14;
    for (const s of scenarios) {
      ensure(20);
      const isSugg = s.scenario.id === suggestedId;
      const color = isSugg ? EMBER : INK;
      page.drawText(s.scenario.label + (isSugg ? "  ★" : ""), { x: MARGIN, y, font: helvBold, size: 10, color });
      page.drawText(s.scenario.blurb, { x: MARGIN, y: y - 12, font: helv, size: 8.5, color: MUTE });
      page.drawText(`${fmt(s.monthly)}`, { x: MARGIN + 230, y, font: helv, size: 10, color: INK });
      page.drawText(`${fmt(s.totalContributed)}`, { x: MARGIN + 320, y, font: helv, size: 10, color: INK });
      page.drawText(`${fmt(s.growth)}`, { x: MARGIN + 410, y, font: helv, size: 10, color: INK });
      y -= 26;
    }
    page.drawText("★ Suggested for your timeline", { x: MARGIN, y, font: helv, size: 8.5, color: MUTE });
    y -= 24;

    // ===== Milestone table (chosen plan, year-by-year) =====
    ensure(140);
    page.drawText(`Milestone schedule — ${fmt(chosenMonthly)}/mo into ${chosenScenario.label.toLowerCase()}`, {
      x: MARGIN, y, font: helvBold, size: 12, color: INK,
    });
    y -= 16;
    page.drawText("Year", { x: MARGIN, y, font: helvBold, size: 8.5, color: MUTE });
    page.drawText("Contributed", { x: MARGIN + 90, y, font: helvBold, size: 8.5, color: MUTE });
    page.drawText("Growth", { x: MARGIN + 220, y, font: helvBold, size: 8.5, color: MUTE });
    page.drawText("Balance", { x: MARGIN + 320, y, font: helvBold, size: 8.5, color: MUTE });
    page.drawText("% of goal", { x: MARGIN + 430, y, font: helvBold, size: 8.5, color: MUTE });
    y -= 4;
    drawHr(page, MARGIN, y, MAX_W, FAINT);
    y -= 14;

    const totalYears = Math.min(15, Math.max(1, Math.ceil(chosenMonthsCapped / 12)));
    for (let yr = 1; yr <= totalYears; yr++) {
      ensure(16);
      const months = yr * 12;
      const balance = futureValue(metrics.saved, chosenMonthly, chosenScenario.rate, months);
      const contributed = chosenMonthly * months;
      const growth = Math.max(0, balance - metrics.saved - contributed);
      const pct = Math.min(100, Math.round((balance / metrics.downPayment) * 100));
      const reached = balance >= metrics.downPayment;
      const color = reached ? SAGE : INK;
      page.drawText(`Year ${yr}${reached ? " ✓" : ""}`, { x: MARGIN, y, font: helvBold, size: 10, color });
      page.drawText(fmtCompact(contributed), { x: MARGIN + 90, y, font: helv, size: 10, color: INK });
      page.drawText(fmtCompact(growth), { x: MARGIN + 220, y, font: helv, size: 10, color: INK });
      page.drawText(fmtCompact(Math.round(balance)), { x: MARGIN + 320, y, font: helv, size: 10, color: INK });
      page.drawText(`${pct}%`, { x: MARGIN + 430, y, font: helv, size: 10, color });
      y -= 14;
      if (reached) break;
    }
    y -= 14;

    // ===== 12-month action checklist =====
    ensure(200);
    page.drawText("Your 12-month action checklist", { x: MARGIN, y, font: helvBold, size: 12, color: INK });
    y -= 16;
    const checklist = buildChecklist({
      monthly: chosenMonthly,
      scenarioLabel: chosenScenario.label,
      years: metrics.timelineYears,
    });
    for (const item of checklist) {
      ensure(28);
      page.drawRectangle({ x: MARGIN, y: y - 2, width: 9, height: 9, borderColor: INK, borderWidth: 0.6, color: rgb(1, 1, 1) });
      page.drawText(item.label, { x: MARGIN + 16, y, font: helvBold, size: 10, color: INK });
      const lines = wrap(item.body, helv, 9.5, MAX_W - 18);
      let cy = y - 12;
      for (const ln of lines) {
        ensure(12);
        page.drawText(ln, { x: MARGIN + 16, y: cy, font: helv, size: 9.5, color: MUTE });
        cy -= 12;
      }
      y = cy - 6;
    }

    // ===== Allocation guidance =====
    y -= 6;
    ensure(60);
    page.drawText(`Suggested allocation for your ~${metrics.timelineYears}-year timeline`, {
      x: MARGIN, y, font: helvBold, size: 12, color: INK,
    });
    y -= 16;
    const alloc = pickAllocation(metrics.timelineYears);
    for (const ln of wrap(alloc, helv, 10.5, MAX_W)) {
      ensure(14);
      page.drawText(ln, { x: MARGIN, y, font: helv, size: 10.5, color: INK });
      y -= 14;
    }

    // Save & encode
    const bytes = await pdf.save();
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const filename = `keystone-${slugify(planTitle)}-investment-plan-${todayStamp()}.pdf`;
    return { ok: true as const, base64, filename };
  });

// ============= helpers =============

function drawFooter(page: PDFPage, font: PDFFont) {
  page.drawText(
    "Educational projection — not investment, tax, or legal advice. Returns are illustrative and not guaranteed.",
    { x: 54, y: 40, font, size: 8, color: MUTE },
  );
  page.drawText("Generated by Keystone · keystonehomeowner.lovable.app", { x: 54, y: 28, font, size: 8, color: MUTE });
}

function drawHr(page: PDFPage, x: number, y: number, w: number, color: RGB) {
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, color, thickness: 0.6 });
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawGrowthChart(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  opts: { x: number; y: number; w: number; h: number; saved: number; target: number; months: number },
) {
  const { x, y, w, h, saved, target, months } = opts;
  const padL = 44;
  const padR = 8;
  const padT = 8;
  const padB = 18;
  const innerX = x + padL;
  const innerY = y + padB;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  // Determine y-axis range — use largest scenario end value or target*1.1
  const yMaxRaw = Math.max(
    target * 1.1,
    ...SCENARIOS.map((s) => futureValue(saved, requiredMonthlyOrZero(saved, target, months, s.rate), s.rate, months)),
  );
  const yMax = niceCeil(yMaxRaw);

  // Background
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(0.99, 0.99, 0.97) });

  // Grid + y labels (4 ticks)
  for (let i = 0; i <= 4; i++) {
    const gy = innerY + (innerH * i) / 4;
    page.drawLine({
      start: { x: innerX, y: gy },
      end: { x: innerX + innerW, y: gy },
      color: rgb(0.92, 0.92, 0.90),
      thickness: 0.4,
    });
    const v = (yMax * i) / 4;
    const label = fmtCompactSafe(v);
    page.drawText(label, {
      x: innerX - font.widthOfTextAtSize(label, 7.5) - 4,
      y: gy - 3,
      font, size: 7.5, color: MUTE,
    });
  }

  // X-axis labels (every ~quarter of timeline, max 5)
  const xTicks = Math.min(5, Math.max(2, Math.round(months / 12) + 1));
  for (let i = 0; i < xTicks; i++) {
    const m = Math.round((months * i) / (xTicks - 1));
    const gx = innerX + (innerW * i) / (xTicks - 1);
    const lbl = m === 0 ? "now" : `${(m / 12).toFixed(m % 12 === 0 ? 0 : 1)}y`;
    page.drawText(lbl, {
      x: gx - font.widthOfTextAtSize(lbl, 7.5) / 2,
      y: innerY - 12,
      font, size: 7.5, color: MUTE,
    });
  }

  // Target line
  const targetY = innerY + (innerH * (target / yMax));
  // Dashed-ish target line (series of small segments)
  const dash = 4;
  for (let dx = 0; dx < innerW; dx += dash * 2) {
    page.drawLine({
      start: { x: innerX + dx, y: targetY },
      end: { x: innerX + Math.min(dx + dash, innerW), y: targetY },
      color: MUTE, thickness: 0.7,
    });
  }
  page.drawText(`Goal ${fmtCompactSafe(target)}`, {
    x: innerX + innerW - fontBold.widthOfTextAtSize(`Goal ${fmtCompactSafe(target)}`, 7.5) - 2,
    y: targetY + 3,
    font: fontBold, size: 7.5, color: MUTE,
  });

  // Sample 36 points per scenario, draw polyline
  const N = 36;
  for (const s of SCENARIOS) {
    const monthly = requiredMonthlyOrZero(saved, target, months, s.rate);
    const color = SCENARIO_COLOR[s.id];
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i <= N; i++) {
      const m = (months * i) / N;
      const v = futureValue(saved, monthly, s.rate, m);
      const px = innerX + (innerW * i) / N;
      const py = innerY + innerH * Math.min(1, Math.max(0, v / yMax));
      if (prev) {
        page.drawLine({ start: prev, end: { x: px, y: py }, color, thickness: 1.2 });
      }
      prev = { x: px, y: py };
    }
  }
}

function requiredMonthlyOrZero(saved: number, target: number, months: number, rate: number) {
  if (saved >= target) return 0;
  const r = rate / 12;
  if (r === 0) return Math.max(0, (target - saved) / months);
  const g = Math.pow(1 + r, months);
  return Math.max(0, (target - saved * g) / ((g - 1) / r));
}

function fmtCompactSafe(n: number) {
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function niceCeil(n: number) {
  if (n <= 0) return 1000;
  const exp = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / exp;
  let nice: number;
  if (f <= 1) nice = 1;
  else if (f <= 2) nice = 2;
  else if (f <= 5) nice = 5;
  else nice = 10;
  return nice * exp;
}

function buildChecklist(opts: { monthly: number; scenarioLabel: string; years: number }) {
  const { monthly, scenarioLabel, years } = opts;
  const useHysa = years < 5;
  return [
    {
      label: "Month 1 — Open the right account",
      body: useHysa
        ? `Open a high-yield savings account (Marcus, Ally, Wealthfront, Capital One 360 — pick one with no fees and 4%+ APY). This will hold your down payment.`
        : `Open a brokerage account (Fidelity, Schwab, or Vanguard) and a high-yield savings account. The brokerage holds your invested portion (${scenarioLabel.toLowerCase()}); the HYSA holds your cash buffer.`,
    },
    {
      label: `Month 1 — Automate ${fmt(monthly)} per month`,
      body: `Set up an automatic transfer of ${fmt(monthly)} on your payday into the account above. Treat it like rent — non-negotiable. Automation beats willpower.`,
    },
    {
      label: "Month 1 — Pick your funds (if investing)",
      body: useHysa
        ? "Skip — you're staying in cash for this timeline."
        : "For the invested portion, default to a low-cost total-market index fund (VTI, FXAIX, or a target-date fund within ~2 years of your purchase date). Don't pick individual stocks.",
    },
    {
      label: "Month 3 — Verify your APY / returns",
      body: "HYSA rates change quarterly. If your bank dropped below 4%, move to a competitor. Takes 15 minutes.",
    },
    {
      label: "Month 6 — Half-year checkpoint",
      body: "Log into the account. Confirm your balance is roughly on track with the milestone schedule above. If you're behind, increase the auto-transfer or extend your timeline.",
    },
    {
      label: "Month 12 — Annual rebalance",
      body: useHysa
        ? "Re-shop HYSAs. Confirm contributions are still automated. Update your Keystone plan with any income/savings changes."
        : "Rebalance your invested portion back to your target allocation (sell winners, buy laggards). Re-shop HYSA rates. Update your Keystone plan with any income/savings changes.",
    },
    {
      label: "12 months before purchase — De-risk",
      body: "Once you're within a year of buying, move any remaining invested money into HYSA. You don't want a 20% market drop the month before closing.",
    },
  ];
}
