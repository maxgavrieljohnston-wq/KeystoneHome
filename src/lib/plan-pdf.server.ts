import { computePlanMetrics, computeGoalProgress } from "@/lib/plan-metrics";

export type PlanPdfInput = {
  id: string;
  email: string;
  title: string | null;
  answers: Record<string, unknown> | null;
  assumptions?: Record<string, number> | null;
  theme?: "light" | "dark" | "sepia" | null;
  created_at?: string | null;
  target_move_in?: string | null;
  current_savings?: number | null;
};

type Theme = {
  bg: [number, number, number];
  ink: [number, number, number];
  mute: [number, number, number];
  faint: [number, number, number];
  ember: [number, number, number];
  sage: [number, number, number];
  gold: [number, number, number];
};

const THEMES: Record<"light" | "dark" | "sepia", Theme> = {
  light: {
    bg: [1, 1, 1],
    ink: [0.10, 0.10, 0.10],
    mute: [0.42, 0.42, 0.42],
    faint: [0.85, 0.82, 0.75],
    ember: [0.77, 0.27, 0.18],
    sage: [0.32, 0.50, 0.36],
    gold: [0.78, 0.60, 0.20],
  },
  sepia: {
    bg: [0.98, 0.95, 0.88],
    ink: [0.20, 0.15, 0.08],
    mute: [0.46, 0.38, 0.26],
    faint: [0.78, 0.70, 0.55],
    ember: [0.72, 0.30, 0.12],
    sage: [0.36, 0.46, 0.28],
    gold: [0.70, 0.52, 0.10],
  },
  dark: {
    bg: [0.07, 0.07, 0.08],
    ink: [0.94, 0.94, 0.92],
    mute: [0.65, 0.65, 0.62],
    faint: [0.28, 0.28, 0.30],
    ember: [0.95, 0.46, 0.32],
    sage: [0.55, 0.78, 0.58],
    gold: [0.95, 0.78, 0.36],
  },
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

  const t = THEMES[plan.theme ?? "light"];
  const ink = rgb(...t.ink);
  const mute = rgb(...t.mute);
  const faint = rgb(...t.faint);
  const ember = rgb(...t.ember);
  const sage = rgb(...t.sage);
  const gold = rgb(...t.gold);

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

  // Page background (matters for dark/sepia)
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...t.bg) });

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

  const title = plan.title || `${m.homeStyleLabel} in ${m.city}`;
  page.drawText(title, { x: M, y, size: 26, font: serifBold, color: ink });
  y -= 18;
  page.drawText(`Prepared for ${fullName}`, { x: M, y, size: 11, font: serifItalic, color: mute });
  const dateStr = `Generated ${new Date().toLocaleDateString()}`;
  page.drawText(dateStr, {
    x: W - M - serif.widthOfTextAtSize(dateStr, 11),
    y, size: 11, font: serif, color: mute,
  });
  y -= 22;

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
  row("Principal & interest", money(m.monthlyMortgage));
  row("Taxes & insurance", money(m.taxIns));
  if (m.pmi > 0) row("PMI", money(m.pmi));
  if (m.hoa > 0) row("HOA", money(m.hoa));
  if (m.reserve > 0) row("Maintenance reserve", money(m.reserve));
  page.drawLine({ start: { x: M, y: y + 9 }, end: { x: W - M, y: y + 9 }, color: ink, thickness: 0.4 });
  y -= 2;
  row("Total per month", money(m.totalHousing), { bold: true });
  row(
    `vs household income (${money(m.monthlyIncome)}/mo)`,
    `${Math.round(m.housingRatio * 100)}% — ${m.verdict}`,
    { color: verdictColor },
  );
  y -= 10;

  sectionHeader("02", "Cash to close");
  row("Down payment", money(m.downPayment));
  row("Closing costs (est.)", money(m.closing));
  row("Moving (est.)", money(m.moving));
  page.drawLine({ start: { x: M, y: y + 9 }, end: { x: W - M, y: y + 9 }, color: ink, thickness: 0.4 });
  y -= 2;
  row("Total cash needed", money(m.cashToClose), { bold: true });

  // Goal tracker (only when user has set one)
  const g = computeGoalProgress(m, plan.current_savings ?? null, plan.target_move_in ?? null);
  if (g.hasGoal) {
    y -= 2;
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
  y -= 10;

  sectionHeader("03", "Path to your deposit");
  row("Already saved", money(m.saved));
  row(`Target deposit (${m.downPct}% down)`, money(m.downPayment));
  row(`Save-only — ${m.timelineYears} yr to target`, `${money(m.monthlyToSave)}/mo`);
  row(
    `Invest @ ${(m.expectedReturnRate * 100).toFixed(1)}% — same target`,
    `${money(m.monthlyInvested)}/mo`,
    { color: sage },
  );
  y -= 10;

  sectionHeader("04", "Buyer readiness");
  row("Score", `${m.readiness} / 100 — ${m.readinessLabel}`, {
    bold: true,
    color: m.readiness >= 60 ? sage : m.readiness >= 40 ? gold : ember,
  });
  row("Credit (qualifying)", String(qCredit));
  row("Debt-to-income (with new house)", `${Math.round(dti * 100)}%`);
  row("Mortgage rate (est.)", `${(m.mortgageRate * 100).toFixed(2)}%`);
  y -= 10;

  sectionHeader("05", "Next steps");
  const nextSteps = [
    `Open a high-yield savings account and automate ${money(m.monthlyToSave)}/mo on payday.`,
    m.timelineYears >= 3
      ? `Consider investing the surplus — at ~${(m.expectedReturnRate * 100).toFixed(0)}%, you'd only need ${money(m.monthlyInvested)}/mo for the same goal.`
      : `Stay in cash — your timeline is too short for market risk.`,
    m.readiness < 60
      ? `Boost readiness: pay down high-interest debt and re-check your credit score in 3 months.`
      : `Get pre-qualified with 2–3 lenders to confirm your rate before house-hunting.`,
    `Re-open this plan in 6 months to refresh prices, rates, and your savings progress.`,
  ];
  for (const step of nextSteps) {
    page.drawCircle({ x: M + 4, y: y + 4, size: 1.6, color: ember });
    const lines = wrapPdfText(step, serif, 10.5, W - M * 2 - 14);
    let sy = y;
    for (const ln of lines) {
      page.drawText(ln, { x: M + 14, y: sy, size: 10.5, font: serif, color: ink });
      sy -= 13;
    }
    y = sy - 4;
  }
  y -= 6;

  sectionHeader("06", "Profile snapshot");
  row("Location", `${m.city}${m.zip ? ` · ${m.zip}` : ""}`);
  row("Home", m.homeStyleLabel);
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
  const footRight = "keystonehomeowner.lovable.app";
  page.drawText(footRight, {
    x: W - M - mono.widthOfTextAtSize(footRight, 8),
    y, size: 8, font: mono, color: mute,
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
