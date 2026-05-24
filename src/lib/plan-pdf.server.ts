import { computePlanMetrics, computeGoalProgress } from "@/lib/plan-metrics";
import { getPlanTheme, hexToRgb01, type PlanThemeId } from "@/lib/plan-themes";
import { STRATEGIES, calcRequiredMonthly } from "@/lib/keystone";

export type PlanPdfInput = {
  id: string;
  email: string;
  title: string | null;
  answers: Record<string, unknown> | null;
  assumptions?: Record<string, number> | null;
  theme?: PlanThemeId | null;
  created_at?: string | null;
  target_move_in?: string | null;
  current_savings?: number | null;
};

export async function buildPlanPdfBytes(plan: PlanPdfInput): Promise<{
  bytes: Uint8Array;
  filename: string;
  title: string;
}> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const monoBold = await doc.embedFont(StandardFonts.CourierBold);

  const t = getPlanTheme(plan.theme ?? "light");
  const bg = hexToRgb01(t.paper);
  const ink = rgb(...hexToRgb01(t.ink));
  const mute = rgb(...hexToRgb01(t.inkMute));
  const faint = rgb(...hexToRgb01(t.faint));
  const ember = rgb(...hexToRgb01(t.ember));
  const sage = rgb(...hexToRgb01(t.sage));
  const gold = rgb(...hexToRgb01(t.gold));

  const a = (plan.answers ?? {}) as Record<string, unknown>;
  const str = (k: string): string | null => {
    const v = a[k];
    return typeof v === "string" && v.length ? v : null;
  };
  const bool = (k: string): boolean => a[k] === true;
  const num = (k: string, fb = 0): number => {
    const v = a[k];
    return typeof v === "number" && isFinite(v) ? v : fb;
  };

  const m = computePlanMetrics(a, plan.assumptions ?? null);

  const firstName = str("firstName") ?? "";
  const lastName = str("lastName") ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || plan.email;
  const hasPartner = bool("hasPartner");
  const combinedIncome = num("income") + (hasPartner ? num("partnerIncome") : 0);
  const expenses = num("expenses") + (hasPartner ? num("partnerExpenses") : 0);
  const debt = num("debt") + (hasPartner ? num("partnerDebt") : 0);
  const credit = num("credit", 700);
  const partnerCredit = num("partnerCredit", credit);
  const qCredit = hasPartner ? Math.min(credit, partnerCredit) : credit;
  const dti = m.monthlyIncome > 0 ? (debt + m.totalHousing) / m.monthlyIncome : 0;
  const verdictColor =
    m.verdict === "Affordable" ? sage : m.verdict === "A stretch" ? gold : ember;

  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

  const W = 612;
  const H = 792;
  const M = 50;
  const LH = 15; // tightened row line-height

  // Page background (matters for dark/sepia)
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(bg[0], bg[1], bg[2]) });

  let y = 752;

  page.drawText("KEYSTONE", { x: M, y, size: 12, font: monoBold, color: ink });
  const headerRight = "HOMEBUYING PLAN";
  page.drawText(headerRight, {
    x: W - M - mono.widthOfTextAtSize(headerRight, 9),
    y: y + 2, size: 9, font: mono, color: mute,
  });
  y -= 10;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, color: ink, thickness: 0.8 });
  y -= 26;

  page.drawText("YOUR PLAN, PREPARED", { x: M, y, size: 8, font: mono, color: ember });
  y -= 20;

  const title = plan.title || `${m.homeStyleLabel} in ${m.city}`;
  page.drawText(title, { x: M, y, size: 24, font: serifBold, color: ink });
  y -= 16;
  page.drawText(`Prepared for ${fullName}`, { x: M, y, size: 11, font: serifItalic, color: mute });
  const dateStr = `Generated ${new Date().toLocaleDateString()}`;
  page.drawText(dateStr, {
    x: W - M - serif.widthOfTextAtSize(dateStr, 11),
    y, size: 11, font: serif, color: mute,
  });
  y -= 18;

  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, color: ink, thickness: 0.6 });
  const colW = (W - M * 2) / 3;
  const statY = y - 14;
  const stats: Array<[string, string]> = [
    ["EST. PRICE", money(m.targetPrice)],
    ["DOWN", `${m.downPct}%`],
    ["= DEPOSIT", money(m.downPayment)],
  ];
  stats.forEach(([label, val], i) => {
    const x = M + colW * i + 8;
    page.drawText(label, { x, y: statY, size: 8, font: mono, color: mute });
    page.drawText(val, { x, y: statY - 20, size: 20, font: serifBold, color: ink });
  });
  y = statY - 32;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, color: ink, thickness: 0.6 });
  y -= 20;

  const sectionHeader = (n: string, label: string) => {
    page.drawText(n, { x: M, y, size: 8, font: mono, color: ember });
    page.drawText(label.toUpperCase(), { x: M + 22, y, size: 8, font: mono, color: ink });
    y -= 5;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, color: faint, thickness: 0.4 });
    y -= 14;
  };

  const row = (label: string, val: string, opts: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
    page.drawText(label, { x: M, y, size: 11, font: serif, color: ink });
    const f = opts.bold ? serifBold : serif;
    const valW = f.widthOfTextAtSize(val, 11.5);
    page.drawText(val, { x: W - M - valW, y, size: 11.5, font: f, color: opts.color ?? ink });
    y -= LH;
  };

  sectionHeader("01", "Monthly housing cost");
  row("Principal & interest", money(m.monthlyMortgage));
  row("Taxes & insurance", money(m.taxIns));
  if (m.pmi > 0) row("PMI", money(m.pmi));
  if (m.hoa > 0) row("HOA", money(m.hoa));
  if (m.reserve > 0) row("Maintenance reserve", money(m.reserve));
  page.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, color: ink, thickness: 0.4 });
  y -= 1;
  row("Total per month", money(m.totalHousing), { bold: true });
  row(
    `vs household income (${money(m.monthlyIncome)}/mo)`,
    `${Math.round(m.housingRatio * 100)}% — ${m.verdict}`,
    { color: verdictColor },
  );
  y -= 8;

  sectionHeader("02", "Cash to close");
  row("Down payment", money(m.downPayment));
  row("Closing costs (est.)", money(m.closing));
  row("Moving (est.)", money(m.moving));
  page.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, color: ink, thickness: 0.4 });
  y -= 1;
  row("Total cash needed", money(m.cashToClose), { bold: true });

  // Goal tracker (only when user has set one)
  const g = computeGoalProgress(m, plan.current_savings ?? null, plan.target_move_in ?? null);
  if (g.hasGoal) {
    if (plan.current_savings != null) {
      row("Saved so far", `${money(plan.current_savings)} (${g.pctToGoal.toFixed(0)}% of goal)`, {
        color: g.pctToGoal >= 100 ? sage : g.pctToGoal >= 50 ? gold : ink,
      });
    }
    if (plan.target_move_in) {
      row(
        `Target move-in${g.monthsToGoal != null ? ` (${g.monthsToGoal} mo)` : ""}`,
        new Date(plan.target_move_in).toLocaleDateString(),
      );
    }
    if (g.requiredMonthly != null && g.remaining > 0) {
      row("Required savings to hit goal", `${money(g.requiredMonthly)}/mo`, { bold: true });
    }
  }
  y -= 8;

  // ── 03. Save-vs-invest comparison chart ─────────────────────────────────
  sectionHeader("03", `Path to your deposit — ${m.timelineYears} yr`);
  row("Already saved", money(m.saved));
  row(`Target deposit (${m.downPct}% down)`, money(m.downPayment));
  y -= 4;

  // Build tier rows: Save-only (0%) + four strategies
  const months = m.timelineYears * 12;
  type TierRow = { label: string; rate: number; monthly: number };
  const tiers: TierRow[] = [
    { label: "Save only", rate: 0, monthly: calcRequiredMonthly(m.saved, m.downPayment, months, 0) },
    ...STRATEGIES.map<TierRow>((s) => ({
      label: s.label,
      rate: s.rate,
      monthly: calcRequiredMonthly(m.saved, m.downPayment, months, s.rate),
    })),
  ];
  const maxMonthly = Math.max(1, ...tiers.map((t) => t.monthly));
  const selectedRate = m.expectedReturnRate;

  const barLabelW = 96;
  const barValueW = 96;
  const barTrackX = M + barLabelW;
  const barTrackW = W - M * 2 - barLabelW - barValueW - 8;
  const barH = 9;
  const barGap = 14;

  for (const tier of tiers) {
    const isSelected = Math.abs(tier.rate - selectedRate) < 0.0005;
    const w = Math.max(2, (tier.monthly / maxMonthly) * barTrackW);
    // label
    const labelTxt = tier.rate > 0 ? `${tier.label} ${(tier.rate * 100).toFixed(1)}%` : tier.label;
    page.drawText(labelTxt, {
      x: M, y: y, size: 9, font: isSelected ? serifBold : serif, color: isSelected ? ember : ink,
    });
    // track
    page.drawRectangle({
      x: barTrackX, y: y - 1, width: barTrackW, height: barH,
      color: faint, opacity: 0.35,
    });
    // bar
    page.drawRectangle({
      x: barTrackX, y: y - 1, width: w, height: barH,
      color: isSelected ? ember : mute,
    });
    // value
    const valTxt = `${money(tier.monthly)}/mo`;
    const vw = (isSelected ? serifBold : serif).widthOfTextAtSize(valTxt, 10);
    page.drawText(valTxt, {
      x: W - M - vw, y, size: 10, font: isSelected ? serifBold : serif,
      color: isSelected ? ember : ink,
    });
    y -= barGap;
  }
  // caption
  page.drawText("Bar = monthly contribution needed for the same deposit. Highlighted = your strategy.", {
    x: M, y, size: 8, font: serifItalic, color: mute,
  });
  y -= 12;

  // ── 04. Readiness gauge ─────────────────────────────────────────────────
  sectionHeader("04", "Buyer readiness");
  const gaugeW = 240;
  const gaugeH = 8;
  const gx = M;
  const gy = y - 2;
  // three color zones
  page.drawRectangle({ x: gx, y: gy, width: gaugeW * 0.4, height: gaugeH, color: ember, opacity: 0.25 });
  page.drawRectangle({ x: gx + gaugeW * 0.4, y: gy, width: gaugeW * 0.2, height: gaugeH, color: gold, opacity: 0.3 });
  page.drawRectangle({ x: gx + gaugeW * 0.6, y: gy, width: gaugeW * 0.4, height: gaugeH, color: sage, opacity: 0.3 });
  // outline
  page.drawRectangle({ x: gx, y: gy, width: gaugeW, height: gaugeH, borderColor: ink, borderWidth: 0.5, opacity: 0 });
  // marker
  const scorePct = Math.max(0, Math.min(100, m.readiness)) / 100;
  const markerX = gx + gaugeW * scorePct;
  const markerColor = m.readiness >= 60 ? sage : m.readiness >= 40 ? gold : ember;
  page.drawRectangle({ x: markerX - 1, y: gy - 3, width: 2, height: gaugeH + 6, color: markerColor });
  // label to the right
  const scoreTxt = `${m.readiness} / 100 — ${m.readinessLabel}`;
  page.drawText(scoreTxt, {
    x: gx + gaugeW + 14, y: gy + 1, size: 11, font: serifBold, color: markerColor,
  });
  y -= 18;
  row("Credit (qualifying)", String(qCredit));
  row("Debt-to-income (with new house)", `${Math.round(dti * 100)}%`);
  row("Mortgage rate (est.)", `${(m.mortgageRate * 100).toFixed(2)}%`);
  y -= 6;

  // ── 05. Personalized next steps ─────────────────────────────────────────
  sectionHeader("05", "Next steps");
  const steps: string[] = [];
  if (m.housingRatio > 0.36 && m.monthlyIncome > 0) {
    const targetRatio = 0.33;
    const allowedHousing = m.monthlyIncome * targetRatio;
    const scale = m.totalHousing > 0 ? allowedHousing / m.totalHousing : 1;
    const suggestedPrice = Math.max(50000, Math.round((m.targetPrice * scale) / 5000) * 5000);
    steps.push(`Housing is ${Math.round(m.housingRatio * 100)}% of income — consider a target closer to ${money(suggestedPrice)} to bring it under 33%.`);
  }
  if (dti > 0.43 && m.monthlyIncome > 0) {
    const targetDti = 0.40;
    const reduceBy = Math.max(0, debt + m.totalHousing - m.monthlyIncome * targetDti);
    steps.push(`Pay down about ${money(reduceBy)}/mo of debt — that drops your DTI under 40% and unlocks better rates.`);
  }
  if (qCredit < 680) {
    steps.push(`Raise your ${hasPartner ? "qualifying " : ""}credit score above 680 — it's the single biggest lever on your mortgage rate.`);
  }
  if (m.timelineYears < 3) {
    steps.push(`Stay in cash — your ${m.timelineYears}-year timeline is too short for market risk. Automate ${money(m.monthlyToSave)}/mo into a high-yield savings account.`);
  } else {
    const selectedTier = tiers.find((t) => Math.abs(t.rate - selectedRate) < 0.0005);
    if (selectedTier && selectedTier.rate > 0) {
      steps.push(`At your ${(selectedRate * 100).toFixed(1)}% strategy, ${money(selectedTier.monthly)}/mo gets you to the deposit — automate it on payday.`);
    } else {
      steps.push(`Automate ${money(m.monthlyToSave)}/mo on payday into a high-yield savings account.`);
    }
  }
  if (g.hasGoal && g.requiredMonthly != null && g.requiredMonthly > m.monthlyToSave * 1.2) {
    const extra = Math.ceil((g.requiredMonthly / Math.max(1, m.monthlyToSave) - 1) * m.timelineYears * 12);
    steps.push(`Your target date needs ${money(g.requiredMonthly)}/mo — extend move-in by ~${extra} months to make it comfortable.`);
  }
  steps.push(`Re-open this plan in 6 months to refresh prices, rates, and your savings progress.`);

  for (const step of steps.slice(0, 4)) {
    page.drawCircle({ x: M + 4, y: y + 4, size: 1.6, color: ember });
    const lines = wrapPdfText(step, serif, 10.5, W - M * 2 - 14);
    let sy = y;
    for (const ln of lines) {
      page.drawText(ln, { x: M + 14, y: sy, size: 10.5, font: serif, color: ink });
      sy -= 12.5;
    }
    y = sy - 3;
  }
  y -= 4;

  // ── 06. Profile snapshot ────────────────────────────────────────────────
  sectionHeader("06", "Profile snapshot");
  row("Location", `${m.city}${m.zip ? ` · ${m.zip}` : ""}`);
  row("Home", m.homeStyleLabel);
  row("Household", hasPartner ? "Two-person" : "Solo");
  row("Combined income", `${money(combinedIncome)}/yr`);
  // Drop the lowest-priority rows if we'd collide with the footer (y < 75)
  if (y > 78) row("Monthly expenses", `${money(expenses)}/mo`);
  if (y > 78) row("Total debt payments", `${money(debt)}/mo`);

  // Footer
  const footY = 50;
  page.drawLine({ start: { x: M, y: footY + 12 }, end: { x: W - M, y: footY + 12 }, color: faint, thickness: 0.4 });
  page.drawText("Keystone — your path to homeownership.", {
    x: M, y: footY, size: 9, font: serifItalic, color: mute,
  });
  const footRight = "keystonehomeowners.com";
  const footRightW = mono.widthOfTextAtSize(footRight, 8);
  page.drawText(footRight, {
    x: W - M - footRightW, y: footY, size: 8, font: mono, color: mute,
  });
  const pageNum = "Page 1 of 1";
  const pageNumW = mono.widthOfTextAtSize(pageNum, 8);
  page.drawText(pageNum, {
    x: W - M - footRightW - 16 - pageNumW, y: footY, size: 8, font: mono, color: mute,
  });

  const bytes = await doc.save();
  const safeTitle = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "keystone-plan";
  return { bytes, filename: `${safeTitle}.pdf`, title };
}

function wrapPdfText(
  text: string,
  font: { widthOfTextAtSize: (s: string, size: number) => number },
  size: number,
  maxWidth: number,
): string[] {
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
