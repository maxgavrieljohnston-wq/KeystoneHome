import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getSharedPlan } from "@/lib/plans.functions";
import {
  HOME_STYLES,
  styleAdjustments,
  calcMortgage,
  calcRequiredMonthly,
  rateFromCredit,
  rateAddFromDownPct,
  combinedEmploymentAdjustment,
  getPriceByZip,
  fmt,
} from "@/lib/keystone";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    try {
      return await getSharedPlan({ data: { slug: params.slug } });
    } catch {
      throw notFound();
    }
  },
  notFoundComponent: () => (
    <div style={{ minHeight: "100vh", background: "#f5efe6", padding: 60, fontFamily: "Georgia, serif", textAlign: "center" }}>
      <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>This plan isn't shared.</h1>
      <p style={{ color: "#6b6b6b" }}>The link may have been revoked or never enabled.</p>
      <Link to="/" style={{ color: "#c4452d", marginTop: 20, display: "inline-block" }}>
        Build your own plan →
      </Link>
    </div>
  ),
  errorComponent: () => (
    <div style={{ minHeight: "100vh", padding: 60, textAlign: "center" }}>
      <p>Something went wrong loading this plan.</p>
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Shared homebuying plan — Keystone" },
      { name: "description", content: "A homebuying plan built with Keystone." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedPlanPage,
});

import { getPlanTheme, type PlanTheme } from "@/lib/plan-themes";

function SharedPlanPage() {
  const { plan } = Route.useLoaderData();
  return <PlanView plan={plan} />;
}

export type PlanViewPlan = {
  title?: string | null;
  theme?: string | null;
  answers?: Record<string, unknown> | null;
  assumptions?: Record<string, number> | null;
  current_savings?: number | null;
  target_move_in?: string | null;
  created_at?: string | null;
};

export function PlanView({
  plan,
  kicker = "— A shared Keystone plan",
  footer,
}: {
  plan: PlanViewPlan;
  kicker?: string;
  footer?: React.ReactNode;
}) {
  const theme = getPlanTheme(plan.theme as string | null);
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
  const styleName = HOME_STYLES.find((s) => s.id === styleId)?.label ?? "Home";
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

  const closing = Math.round(targetPrice * (ov.closingCostPct ?? 3) / 100);
  const moving = ov.movingCost ?? 1500;
  const totalCash = downPayment + closing + moving;

  const saved = (plan.current_savings as number | null) ?? num("saved");
  const timelineYears = num("timelineYears", 3);
  const months = timelineYears * 12;
  const returnRate = ov.expectedReturnPct != null ? ov.expectedReturnPct / 100 : 0.07;
  const savedOnly = calcRequiredMonthly(saved, downPayment, months, 0);
  const invested = calcRequiredMonthly(saved, downPayment, months, returnRate);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.paper,
        color: theme.ink,
        padding: "48px 24px 80px",
        fontFamily: "'Cormorant Garamond', Georgia, serif",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: theme.ember,
            marginBottom: 14,
          }}
        >
          {kicker}
        </div>
        <h1 style={{ fontSize: 44, fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          {plan.title || `${styleName} in ${zipData.city}`}
        </h1>
        {plan.created_at && (
          <p style={{ color: theme.inkMute, fontSize: 14, margin: "0 0 32px" }}>
            Generated {new Date(plan.created_at as string).toLocaleDateString()}
          </p>
        )}

        <Stat label="Target price" value={fmt(targetPrice)} theme={theme} big />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <Stat label="Down payment" value={`${effectiveDownPct}% · ${fmt(downPayment)}`} theme={theme} />
          <Stat label="Cash to close" value={fmt(totalCash)} theme={theme} />
        </div>

        <Section title="Monthly housing" theme={theme}>
          <Row k="Principal & interest" v={fmt(mortgage)} theme={theme} />
          <Row k="Taxes & insurance" v={fmt(taxIns)} theme={theme} />
          {pmi > 0 && <Row k="PMI" v={fmt(pmi)} theme={theme} />}
          {hoa > 0 && <Row k="HOA" v={fmt(hoa)} theme={theme} />}
          <Row k="Maintenance reserve" v={fmt(styleAdj.reserve)} theme={theme} />
          <Row k="Total" v={fmt(totalHousing)} theme={theme} bold />
        </Section>

        <Section title="Path to deposit" theme={theme}>
          <Row k="Save only" v={`${fmt(savedOnly)} / mo`} theme={theme} />
          <Row k={`Invest @ ${(returnRate * 100).toFixed(0)}%`} v={`${fmt(invested)} / mo`} theme={theme} bold />
        </Section>

        {plan.target_move_in && (
          <Section title="Goal" theme={theme}>
            <Row k="Target move-in" v={new Date(plan.target_move_in as string).toLocaleDateString()} theme={theme} />
            <Row k="Saved so far" v={fmt(saved)} theme={theme} />
          </Section>
        )}

        {footer}

        <div
          style={{
            marginTop: 48,
            paddingTop: 20,
            borderTop: `1px solid ${theme.inkMute}33`,
            textAlign: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: theme.inkMute,
          }}
        >
          Made with{" "}
          <Link to="/" style={{ color: theme.ember, textDecoration: "none" }}>
            Keystone
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, theme, big }: { label: string; value: string; theme: PlanTheme; big?: boolean }) {
  return (
    <div style={{ padding: "16px 18px", border: `1.5px solid ${theme.ink}`, borderRadius: 10 }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: theme.inkMute, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: big ? 36 : 22, lineHeight: 1.1, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}

function Section({ title, theme, children }: { title: string; theme: PlanTheme; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: theme.ember, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ borderTop: `1px solid ${theme.ink}` }}>{children}</div>
    </div>
  );
}

function Row({ k, v, theme, bold }: { k: string; v: string; theme: PlanTheme; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${theme.inkMute}22`, gap: 12 }}>
      <span style={{ color: theme.inkSoft, fontSize: 16 }}>{k}</span>
      <span style={{ fontSize: 16, fontWeight: bold ? 600 : 400 }}>{v}</span>
    </div>
  );
}
