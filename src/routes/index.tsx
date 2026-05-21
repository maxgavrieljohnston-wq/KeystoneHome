import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { upsertLead } from "@/lib/leads.functions";
import { getMyPlan } from "@/lib/account.functions";
import { submitPlan } from "@/lib/plans.functions";
import { deriveAssumptions } from "@/lib/plan-assumptions";
import { getStripeEnvironment } from "@/lib/stripe";

import { HOMEOWNERSHIP_FACTS } from "@/lib/homeownership-facts";
import { getMyPlans } from "@/lib/plans.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { US_STATES, priceByState } from "@/data/states";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import {
  CREDIT_BUCKETS,
  DOWN_BUCKETS,
  EMPLOYMENT_TYPES,
  FACTS,
  HOME_STYLES,
  INTROS,
  RISK_QS,
  STRATEGIES,
  TIMELINE_BUCKETS,
  calcMortgage,
  calcRequiredMonthly,
  deriveRisk,
  fmt,
  fmtCompact,
  getPriceByZip,
  rateFromCredit,
  rateAddFromDownPct,
  styleAdjustments,
  combinedEmploymentAdjustment,
} from "@/lib/keystone";

type IndexSearch = { new?: boolean };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): IndexSearch => ({
    new:
      search.new === true ||
      search.new === "true" ||
      search.new === "1"
        ? true
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Keystone — Plan your first home" },
      {
        name: "description",
        content:
          "An editorial homebuying planner. Tell Keystone about your finances and get a custom plan to your first front door.",
      },
      { property: "og:title", content: "Keystone — Plan your first home" },
      {
        property: "og:description",
        content:
          "Personalized affordability, savings, and readiness for first-time buyers.",
      },
    ],
  }),
  component: KeystoneApp,
});

// ── Palette tokens (inline — editorial warm) ─────────────────────────────────
const C = {
  paper: "#f5efe6",
  paperDeep: "#ebe2d3",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  rule: "#1a1a1a",
  ember: "#c4452d",
  sage: "#5a7a52",
  gold: "#a8853a",
  cream: "#fbf7f0",
};

// ── Flow ─────────────────────────────────────────────────────────────────────
const FLOW = [
  "welcome",
  "email",
  "introFinances",
  "partner",
  "age",
  "employment",
  "finances",
  "credit",
  "partnerInfo",
  "partnerAge",
  "partnerEmployment",
  "partnerFinances",
  "partnerCredit",
  "factDemo",
  "zip",
  "homeStyle",
  "homeFeatures",
  "downGoal",
  // "advancedAssumptions" removed — backend now derives these from the user's metro.
  "timeline",
  "introRisk",
  "risk0",
  "risk1",
  "risk2",
  "risk3",
  "calculating",
  "dashboard",
] as const;
type Screen = (typeof FLOW)[number];

const PROGRESS_SCREENS: Screen[] = [
  "email",
  "introFinances",
  "partner",
  "age", "employment", "finances", "credit",
  "partnerInfo", "partnerAge", "partnerEmployment", "partnerFinances", "partnerCredit",
  "factDemo",
  "zip", "homeStyle", "homeFeatures", "downGoal", "timeline",
  "introRisk",
  "risk0", "risk1", "risk2", "risk3",
];

type Data = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  age: number;
  employment: string | null;
  income: number;
  expenses: number;
  debt: number;
  credit: number | null;
  saved: number;
  hasPartner: boolean | null;
  partnerFirstName: string;
  partnerLastName: string;
  partnerEmail: string;
  partnerAge: number;
  partnerEmployment: string | null;
  partnerIncome: number;
  partnerExpenses: number;
  partnerDebt: number;
  partnerSaved: number;
  partnerCredit: number | null;
  zip: string;
  zipData: { city: string; avg: number } | null;
  homeStyle: string | null;
  beds: number;
  baths: number;
  outdoorSpace: string | null;
  parking: string | null;
  homeLayout: string | null;
  lifestyle: Record<string, "nice" | "must">;
  neighborhood: Record<string, "nice" | "must">;
  timelineYears: number;
  timelineBucket: string | null;
  downGoalPct: number | null;
  riskAnswers: Record<number, number>;
  // assumptions removed — derived on the backend from metro/ZIP.
};

const INITIAL: Data = {
  email: "",
  phone: "",
  firstName: "",
  lastName: "",
  age: 32,
  employment: null,
  income: 75000,
  expenses: 3000,
  debt: 400,
  credit: null,
  saved: 15000,
  hasPartner: null,
  partnerFirstName: "",
  partnerLastName: "",
  partnerEmail: "",
  partnerAge: 32,
  partnerEmployment: null,
  partnerIncome: 0,
  partnerExpenses: 0,
  partnerDebt: 0,
  partnerSaved: 0,
  partnerCredit: null,
  zip: "",
  zipData: null,
  homeStyle: null,
  beds: 2,
  baths: 2,
  outdoorSpace: null,
  parking: null,
  homeLayout: null,
  lifestyle: {},
  neighborhood: {},
  timelineYears: 3,
  timelineBucket: null,
  downGoalPct: null,
  riskAnswers: {},
  
};

// Feature-adjusted price multiplier — same math used live on "Picture the place".
function computeFeatureMult(d: Data): number {
  const baseAdj = styleAdjustments(d.homeStyle ? [d.homeStyle] : []);
  let m = baseAdj.priceMult;
  m += Math.max(0, (d.beds ?? 0) - 3) * 0.05;
  m += Math.max(0, (d.baths ?? 0) - 2) * 0.03;
  if (d.outdoorSpace === "patio") m += 0.02;
  if (d.outdoorSpace === "yard") m += 0.05;
  if (d.parking === "driveway") m += 0.02;
  if (d.parking === "garage") m += 0.05;
  const w = (v: "nice" | "must") => (v === "must" ? 0.025 : 0.01);
  Object.values(d.lifestyle ?? {}).forEach((v) => (m += w(v as "nice" | "must")));
  Object.values(d.neighborhood ?? {}).forEach((v) => (m += w(v as "nice" | "must")));
  return m;
}

// Single source of truth: which down-payment options to offer the user.
// Used both on the down-payment question screen AND on the final results page,
// so the results page mirrors exactly what the user was offered earlier.
type DownOpt = { pct: number; label: string; tag: string; desc: string };
function computeOfferedDownOpts(d: Data): DownOpt[] {
  const zd = d.zipData ?? { city: "your area", avg: 400000 };
  const adj = styleAdjustments(d.homeStyle ? [d.homeStyle] : []);
  const targetPrice = Math.round(zd.avg * computeFeatureMult(d));
  const qCredit =
    d.hasPartner && d.partnerCredit
      ? Math.min(d.credit ?? 700, d.partnerCredit)
      : d.credit ?? 700;
  const empAdj = combinedEmploymentAdjustment(
    d.employment,
    d.hasPartner ? d.partnerEmployment : null,
  );
  const mRate = rateFromCredit(qCredit) + empAdj.rateAdd;
  const rateFor = (pct: number) => mRate + rateAddFromDownPct(pct);

  const grossAnnual = (d.income ?? 0) + (d.hasPartner ? d.partnerIncome ?? 0 : 0);
  const grossMonthly = (grossAnnual * empAdj.incomeFactor) / 12;
  const monthlyDebts = (d.debt ?? 0) + (d.hasPartner ? d.partnerDebt ?? 0 : 0);
  const maxHousing = Math.max(0, grossMonthly * empAdj.dtiCap - monthlyDebts);

  const baseOpts: DownOpt[] = DOWN_BUCKETS.map((b) => ({
    pct: b.pct,
    label: `${b.label} down`,
    tag: b.tag,
    desc: b.desc,
  }));

  const anyQualifies = baseOpts.some(
    (o) => calcMortgage(targetPrice, o.pct, rateFor(o.pct)) <= maxHousing,
  );
  if (!anyQualifies && maxHousing > 0) {
    let lo = 20, hi = 95;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const m = calcMortgage(targetPrice, mid, rateFor(mid));
      if (m > maxHousing) lo = mid;
      else hi = mid;
    }
    const dtiRequiredPct = Math.ceil(hi);
    if (!baseOpts.some((o) => o.pct === dtiRequiredPct)) {
      baseOpts.push({
        pct: dtiRequiredPct,
        label: `${dtiRequiredPct}% down`,
        tag: "DTI-required",
        desc: "Needed to qualify given current debts and income",
      });
    }
  }

  const qualifying = baseOpts.filter(
    (o) => calcMortgage(targetPrice, o.pct, rateFor(o.pct)) <= maxHousing,
  );
  const visible = qualifying.length > 0 ? qualifying : baseOpts;
  return visible.sort((a, b) => a.pct - b.pct);
}

// ── Root component ───────────────────────────────────────────────────────────
function KeystoneApp() {
  const [d, setD] = useState<Data>(INITIAL);
  const [screenIdx, setScreenIdx] = useState(0);
  const screen: Screen = FLOW[screenIdx];
  const sub = useSubscription();
  const fetchMyPlan = useServerFn(getMyPlan);
  const [contactPrefilled, setContactPrefilled] = useState(false);
  const [agePrefilled, setAgePrefilled] = useState(false);
  const navigate = useNavigate();
  const search = Route.useSearch();
  const isNewPlanFlow = search.new === true;

  // Signed-in users normally land on the dashboard. When they explicitly start
  // a new plan (?new=1) we skip the redirect so the wizard runs.
  useEffect(() => {
    if (isNewPlanFlow) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    return () => { cancelled = true; };
  }, [navigate, isNewPlanFlow]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const id = "keystone-fonts";
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=Work+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";
        document.head.appendChild(link);
      }
    }
  }, []);

  // For any signed-in user, pull contact info on file so the wizard doesn't
  // ask for name / email / phone / age again. Falls back gracefully if
  // anything is missing.
  useEffect(() => {
    if (contactPrefilled) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      fetchMyPlan()
        .then((res) => {
          if (cancelled || !res?.email) return;
          const leadAnswers = (res.lead?.answers ?? {}) as Record<string, unknown>;
          const ageFromLead = typeof leadAnswers.age === "number" ? leadAnswers.age : null;
          setD((prev) => ({
            ...prev,
            email: prev.email || res.email || "",
            firstName: prev.firstName || res.lead?.first_name || "",
            lastName: prev.lastName || res.lead?.last_name || "",
            phone: prev.phone || res.lead?.phone || "",
            age: ageFromLead ?? prev.age,
          }));
          if (ageFromLead) setAgePrefilled(true);
          setContactPrefilled(true);
        })
        .catch((err) => console.error("[prefillContact]", err));
    });
    return () => {
      cancelled = true;
    };
  }, [contactPrefilled, fetchMyPlan]);

  const set = <K extends keyof Data>(k: K, v: Data[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  const hasContactOnFile =
    d.email.includes("@") &&
    d.firstName.trim().length > 0 &&
    d.lastName.trim().length > 0;

  const shouldSkip = (idx: number) => {
    const s = FLOW[idx];
    const partnerOnly = ["partnerInfo", "partnerAge", "partnerEmployment", "partnerFinances", "partnerCredit", "introPartnerSummary"];
    if (d.hasPartner === false && partnerOnly.includes(s)) return true;
    // Partnered users enter household totals on the main "finances" screen,
    // so the separate partnerFinances screen is skipped entirely.
    // Partnered users: skip per-partner detail screens. We only need the
    // shared "with a partner" flag plus household totals on the main finances screen.
    if (d.hasPartner === true && ["partnerInfo", "partnerAge", "partnerEmployment", "partnerFinances", "partnerCredit"].includes(s)) return true;
    // Returning users: don't re-ask for name/email/phone or age — we have it on file.
    if (s === "email" && hasContactOnFile) return true;
    if (s === "age" && agePrefilled) return true;
    if (s === "factDemo") {
      const primaryOver = d.age > 38;
      const partnerOver = d.hasPartner ? d.partnerAge > 38 : true;
      if (primaryOver && partnerOver) return true;
    }
    return false;
  };

  const next = () => {
    let nextIdx = screenIdx + 1;
    while (nextIdx < FLOW.length && shouldSkip(nextIdx)) nextIdx += 1;
    setScreenIdx(Math.min(FLOW.length - 1, nextIdx));
  };
  const back = () => {
    let prevIdx = screenIdx - 1;
    while (prevIdx > 0 && shouldSkip(prevIdx)) prevIdx -= 1;
    setScreenIdx(Math.max(0, prevIdx));
  };

  // The welcome screen is a full-bleed editorial landing page, not a wizard step.
  // Render it outside the narrow Shell so it can stretch to the viewport.
  if (screen === "welcome") {
    return <Welcome onStart={next} />;
  }

  return (
    <Shell>
      {screen !== "dashboard" && screen !== "calculating" && (
        <TopBar
          screen={screen}
          onBack={screenIdx > 0 ? back : undefined}
          progress={
            PROGRESS_SCREENS.includes(screen)
              ? (PROGRESS_SCREENS.indexOf(screen) + 1) /
                PROGRESS_SCREENS.length
              : null
          }
        />
      )}
      <Stage keyId={screen}>
        <ScreenSwitch screen={screen} d={d} set={set} next={next} />
      </Stage>
    </Shell>
  );
}

// ── Shell & layout ───────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        color: C.ink,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: "0 22px 60px",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform: translateY(10px) } to { opacity:1; transform: none } }
        @keyframes drawIn { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        body { background: ${C.paper}; }
        ::selection { background: ${C.ember}; color: ${C.cream}; }
        button { font-family: inherit; }
        input { font-family: inherit; }
      `}</style>
      <div style={{ maxWidth: 520, margin: "0 auto", paddingTop: 26 }}>
        {children}
      </div>
    </div>
  );
}

function TopBar({
  screen,
  onBack,
  progress,
}: {
  screen: Screen;
  onBack?: () => void;
  progress: number | null;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {onBack ? (
            <button
              onClick={onBack}
              aria-label="Back"
              style={{
                background: "transparent",
                border: `1px solid ${C.ink}`,
                cursor: "pointer",
                padding: "6px 12px",
                color: C.ink,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontFamily: "'JetBrains Mono', monospace",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ← Back
            </button>
          ) : (
            <div style={{ width: 12 }} />
          )}
          <Wordmark small />
        </div>
      </div>
      {progress !== null && (
        <div
          style={{
            height: 8,
            background: "rgba(26,26,26,0.10)",
            position: "relative",
            overflow: "hidden",
            borderRadius: 999,
            margin: "8px 16px 4px",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: C.ink,
              borderRadius: 999,
              transformOrigin: "left",
              transform: `scaleX(${progress})`,
              transition: "transform 0.5s cubic-bezier(.5,0,.2,1)",
            }}
          />
        </div>
      )}
    </div>
  );
}

function Wordmark({ small }: { small?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontWeight: 600,
        fontSize: small ? 16 : 22,
        letterSpacing: "-0.01em",
        color: C.ink,
      }}
    >
      Keystone
      <span style={{ color: C.ember }}>.</span>
    </span>
  );
}

function Stage({ children, keyId }: { children: React.ReactNode; keyId: string }) {
  return (
    <div
      key={keyId}
      style={{ animation: "fadeUp 0.45s cubic-bezier(.5,0,.2,1) both" }}
    >
      {children}
    </div>
  );
}

// ── Screen router ────────────────────────────────────────────────────────────
function ScreenSwitch({
  screen,
  d,
  set,
  next,
}: {
  screen: Screen;
  d: Data;
  set: <K extends keyof Data>(k: K, v: Data[K]) => void;
  next: () => void;
}) {
  if (screen === "welcome") return <Welcome onStart={next} />;

  if (screen === "email") return <EmailScreen d={d} set={set} next={next} />;

  if (screen === "age")
    return <BirthdayScreen d={d} set={set} onNext={next} which="user" />;

  if (screen === "employment")
    return (
      <Question
        kicker="Work"
        title="How do you earn your income?"
        sub="Lenders generally want to see 2 years of consistent income — whether that's from a job or tax returns."
      >
        <Choices
          options={EMPLOYMENT_TYPES.map((e) => ({
            val: e.id,
            label: e.label,
            desc: e.desc,
          }))}
          value={d.employment}
          onSelect={(v) => set("employment", v as string)}
        />
        <Cta onClick={next} disabled={!d.employment}>
          Continue
        </Cta>
      </Question>
    );

  if (screen === "finances")
    return (
      <Question
        kicker={d.hasPartner ? "Household finances" : "Your finances"}
        title={d.hasPartner ? "Tell us about your household money." : "Tell us about your money."}
        sub={d.hasPartner
          ? "Combined totals for you and your partner — annual household income before taxes; monthly figures for the rest."
          : "Annual income before taxes; monthly figures for the rest."}
      >
        <FinancesForm
          household={!!d.hasPartner}
          income={d.income}
          expenses={d.expenses}
          debt={d.debt}
          saved={d.saved}
          onIncome={(v) => {
            set("income", v);
            if (d.hasPartner) set("partnerIncome", 0);
          }}
          onExpenses={(v) => {
            set("expenses", v);
            if (d.hasPartner) set("partnerExpenses", 0);
          }}
          onDebt={(v) => {
            set("debt", v);
            if (d.hasPartner) set("partnerDebt", 0);
          }}
          onSaved={(v) => {
            set("saved", v);
            if (d.hasPartner) set("partnerSaved", 0);
          }}
        />
        <Cta onClick={next}>Continue</Cta>
      </Question>
    );

  if (screen === "credit")
    return (
      <Question
        kicker="Credit"
        title="What's your credit score?"
        sub="A rough range is fine — it sets your mortgage rate."
      >
        <Choices
          options={CREDIT_BUCKETS.map((b) => ({
            val: b.value,
            label: b.label,
            tag: b.range,
            desc: b.desc,
          }))}
          value={d.credit}
          onSelect={(v) => set("credit", v as number)}
        />
        <Cta onClick={next} disabled={d.credit === null}>
          Continue
        </Cta>
      </Question>
    );



  if (screen === "partner")
    return (
      <Question
        kicker="The household"
        title="Are you buying on your own, or with a partner?"
        sub="Two incomes — and two credit scores — can change the math entirely. We'll start here so the rest of the questions make sense."
      >
        <Choices
          options={[
            { val: 1, label: "With a partner", desc: "Combine our finances" },
            { val: 0, label: "On my own", desc: "Just me on the loan" },
          ]}
          value={d.hasPartner === null ? null : d.hasPartner ? 1 : 0}
          onSelect={(v) => set("hasPartner", v === 1)}
        />
        <Cta onClick={next} disabled={d.hasPartner === null}>
          Continue
        </Cta>
      </Question>
    );

  if (screen === "partnerInfo")
    return (
      <Question
        kicker="Your partner"
        title="What's your partner's name and email?"
        sub="So we can personalize their side of the plan."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28 }}>
          <input
            type="text"
            placeholder="First name"
            value={d.partnerFirstName}
            onChange={(e) => set("partnerFirstName", e.target.value)}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: `1.5px solid ${C.ink}`,
              padding: "12px 0",
              fontSize: 22,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: C.ink,
              outline: "none",
            }}
          />
          <input
            type="text"
            placeholder="Last name"
            value={d.partnerLastName}
            onChange={(e) => set("partnerLastName", e.target.value)}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: `1.5px solid ${C.ink}`,
              padding: "12px 0",
              fontSize: 22,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: C.ink,
              outline: "none",
            }}
          />
          <input
            type="email"
            inputMode="email"
            placeholder="partner@email.com"
            value={d.partnerEmail}
            onChange={(e) => set("partnerEmail", e.target.value)}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: `1.5px solid ${C.ink}`,
              padding: "12px 0",
              fontSize: 22,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: C.ink,
              outline: "none",
            }}
          />
        </div>
        <Cta
          onClick={next}
          disabled={!d.partnerFirstName.trim() || !d.partnerLastName.trim() || !d.partnerEmail.includes("@")}
        >
          Continue
        </Cta>
      </Question>
    );

  if (screen === "partnerAge")
    return <BirthdayScreen d={d} set={set} onNext={next} which="partner" />;

  if (screen === "partnerEmployment")
    return (
      <Question
        kicker="Partner · Work"
        title="How does your partner earn their income?"
        sub="Same rules apply — lenders look for 2 years in the same line of work."
      >
        <Choices
          options={EMPLOYMENT_TYPES.map((e) => ({
            val: e.id,
            label: e.label,
            desc: e.desc,
          }))}
          value={d.partnerEmployment}
          onSelect={(v) => set("partnerEmployment", v as string)}
        />
        <Cta onClick={next} disabled={!d.partnerEmployment}>
          Continue
        </Cta>
      </Question>
    );

  if (screen === "partnerFinances")
    return (
      <Question
        kicker="Partner"
        title="Your partner's finances."
        sub="Annual income before taxes; monthly figures for the rest."
      >
        <FinancesForm
          income={d.partnerIncome}
          expenses={d.partnerExpenses}
          debt={d.partnerDebt}
          saved={d.partnerSaved}
          onIncome={(v) => set("partnerIncome", v)}
          onExpenses={(v) => set("partnerExpenses", v)}
          onDebt={(v) => set("partnerDebt", v)}
          onSaved={(v) => set("partnerSaved", v)}
        />
        <Cta onClick={next}>Continue</Cta>
      </Question>
    );

  if (screen === "partnerCredit")
    return (
      <Question
        kicker="Partner"
        title="Partner's credit score?"
        sub="The lower of your two scores qualifies the loan."
      >
        <Choices
          options={CREDIT_BUCKETS.map((b) => ({
            val: b.value,
            label: b.label,
            tag: b.range,
            desc: b.desc,
          }))}
          value={d.partnerCredit}
          onSelect={(v) => set("partnerCredit", v as number)}
        />
        <Cta onClick={next} disabled={d.partnerCredit === null}>
          Continue
        </Cta>
      </Question>
    );

  if (screen === "zip")
    return <ZipScreen d={d} set={set} next={next} />;

  if (screen === "homeStyle")
    return (
      <Question
        kicker="Style"
        title="What kind of home?"
        sub="Pick the one that fits best — it shifts the price and monthly cost."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 28,
          }}
        >
          {HOME_STYLES.map((s) => {
            const active = d.homeStyle === s.id;
            return (
              <button
                key={s.id}
                onClick={() => set("homeStyle", s.id)}
                style={{
                  background: active ? C.ink : "transparent",
                  color: active ? C.cream : C.ink,
                  border: `1.5px solid ${C.ink}`,
                  borderRadius: 0,
                  padding: "16px 14px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.18s",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: 18,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: active ? "rgba(251,247,240,0.6)" : C.inkMute,
                    lineHeight: 1.4,
                  }}
                >
                  {s.note}
                </div>
              </button>
            );
          })}
        </div>
        <Cta onClick={next} disabled={!d.homeStyle}>
          Continue
        </Cta>
      </Question>
    );

  // advancedAssumptions screen removed — backend derives defaults from metro.

  if (screen === "timeline") {
    const zipData = d.zipData ?? { city: "your area", avg: 400000 };
    const styleIds = d.homeStyle ? [d.homeStyle] : [];
    const adj = styleAdjustments(styleIds);
    const avgPrice = Math.round(zipData.avg * computeFeatureMult(d));
    const candidate = d.downGoalPct ?? 10;
    const effectiveDownPct = Math.max(candidate, adj.minDown);
    const target = Math.round((avgPrice * effectiveDownPct) / 100);

    const householdIncome = (d.income ?? 0) + (d.hasPartner ? d.partnerIncome ?? 0 : 0);
    const householdExpenses = (d.expenses ?? 0) + (d.hasPartner ? d.partnerExpenses ?? 0 : 0);
    const householdDebt = (d.debt ?? 0) + (d.hasPartner ? d.partnerDebt ?? 0 : 0);
    const householdSaved = (d.saved ?? 0) + (d.hasPartner ? d.partnerSaved ?? 0 : 0);
    const takeHomeMonthly = (householdIncome * 0.78) / 12;
    const monthlyExpenses = householdExpenses + householdDebt;
    const headroom = Math.max(0, takeHomeMonthly - monthlyExpenses);
    // Cap at 25% of take-home OR available headroom, whichever is lower. $100 increments.
    const quarterTakeHome = takeHomeMonthly * 0.25;
    const rawMax = Math.min(quarterTakeHome, headroom);
    const maxSave = Math.max(100, Math.floor(rawMax / 100) * 100);

    const remaining = Math.max(0, target - householdSaved);
    // Constrain slider so years range from 15 (min monthly) down to 1 (max monthly), $100 increments.
    const fifteenYearMonthly = Math.max(100, Math.ceil(remaining / 15 / 12 / 100) * 100);
    const oneYearMonthly = Math.max(fifteenYearMonthly, Math.ceil(remaining / 12 / 100) * 100);
    const minMonthly = Math.min(fifteenYearMonthly, Math.max(100, Math.floor(maxSave / 100) * 100));
    const sliderMax = Math.max(minMonthly, Math.min(oneYearMonthly, maxSave));
    const stored = d.timelineBucket?.startsWith("$")
      ? parseInt(d.timelineBucket.slice(1), 10) || minMonthly
      : minMonthly;
    const monthlySave = Math.min(sliderMax, Math.max(minMonthly, stored));
    const yearsToBuy = monthlySave > 0 ? remaining / monthlySave / 12 : 0;
    const yearsLabel = yearsToBuy >= 1
      ? `${yearsToBuy.toFixed(1)} ${yearsToBuy.toFixed(1) === "1.0" ? "year" : "years"}`
      : `${Math.max(1, Math.round(yearsToBuy * 12))} months`;

    return (
      <Question
        kicker="Timeline"
        title="How long would it take without an investment account?"
        sub="Choose the monthly amount you feel comfortable setting aside toward your down payment. We'll show you how long it would take. But don't worry — we can get you there faster."
      >
        <Slider
          value={monthlySave}
          min={minMonthly}
          max={sliderMax}
          step={100}
          format={(v) => fmt(v)}
          unit={`per month toward ${fmt(target)}`}
          maxNote={`Capped at ${fmt(sliderMax)}/mo — about 25% of your take-home pay after expenses and debt. Pushing higher than this rarely sticks month after month.`}
          onChange={(v) => {
            const yrs = v > 0 ? Math.max(1, Math.round(remaining / v / 12)) : 99;
            set("timelineBucket", `$${v}`);
            set("timelineYears", yrs);
          }}
        />
        <div
          style={{
            border: `1px solid ${C.ink}`,
            padding: "20px 18px",
            marginBottom: 20,
            background: C.paperDeep,
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: C.inkMute,
              marginBottom: 8,
            }}
          >
            At {fmt(monthlySave)} / mo, you'd buy in
          </div>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 44,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: C.ink,
            }}
          >
            {yearsLabel}
          </div>
        </div>
        <Cta onClick={next} disabled={!d.timelineBucket}>
          Continue
        </Cta>
      </Question>
    );
  }

  if (screen === "downGoal") {
    const zd = d.zipData ?? { city: "your area", avg: 400000 };
    const adj = styleAdjustments(d.homeStyle ? [d.homeStyle] : []);
    const targetPrice = Math.round(zd.avg * computeFeatureMult(d));
    const qCredit =
      d.hasPartner && d.partnerCredit
        ? Math.min(d.credit ?? 700, d.partnerCredit)
        : d.credit ?? 700;
    const empAdj = combinedEmploymentAdjustment(
      d.employment,
      d.hasPartner ? d.partnerEmployment : null,
    );
    const mRate = rateFromCredit(qCredit) + empAdj.rateAdd;
    // Per-option rate including LTV adjustment (lenders price by down %).
    const rateFor = (pct: number) => mRate + rateAddFromDownPct(pct);

    // Combined household figures
    const hasPartner = d.hasPartner;
    const grossAnnual =
      (d.income ?? 0) + (hasPartner ? d.partnerIncome ?? 0 : 0);
    // Underwriters discount non-W-2 income (2-yr averaging haircut).
    const qualifyingAnnual = grossAnnual * empAdj.incomeFactor;
    const grossMonthly = qualifyingAnnual / 12;
    const monthlyDebts = (d.debt ?? 0) + (hasPartner ? d.partnerDebt ?? 0 : 0);
    const saved = d.saved ?? 0;

    // Lender DTI ceiling — Qualified Mortgage standard, tightened for variable income.
    const DTI_CAP = empAdj.dtiCap;
    // Max mortgage payment lender will allow given existing debts.
    const maxHousing = Math.max(0, grossMonthly * DTI_CAP - monthlyDebts);

    // Find smallest down % that brings mortgage payment under the DTI cap.
    const sortedAsc = [...DOWN_BUCKETS].sort((a, b) => a.pct - b.pct);
    const smallestQualifyingPct: number | null =
      sortedAsc.find(
        (b) => calcMortgage(targetPrice, b.pct, rateFor(b.pct)) <= maxHousing,
      )?.pct ?? null;

    // Prefer 20% (no PMI, best rates) whenever it qualifies.
    let recommendedPct: number | null = null;
    if (
      smallestQualifyingPct !== null &&
      calcMortgage(targetPrice, 20, rateFor(20)) <= maxHousing
    ) {
      recommendedPct = 20;
    } else {
      recommendedPct = smallestQualifyingPct;
    }

    // If even 20% down isn't enough, solve for the down % that exactly hits the cap.
    let dtiRequiredPct: number | null = null;
    if (recommendedPct === null && maxHousing > 0) {
      // Binary search between 20% and 95%.
      let lo = 20,
        hi = 95;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        const m = calcMortgage(targetPrice, mid, rateFor(mid));
        if (m > maxHousing) lo = mid;
        else hi = mid;
      }
      dtiRequiredPct = Math.ceil(hi);
      recommendedPct = dtiRequiredPct;
    }
    if (recommendedPct === null) recommendedPct = 20;

    // Build the option list via shared helper (so results page mirrors it exactly).
    const visibleOpts = computeOfferedDownOpts(d);

    const recDown = Math.round(targetPrice * (recommendedPct / 100));
    const recMonthly = Math.round(calcMortgage(targetPrice, recommendedPct, rateFor(recommendedPct)));
    const recDTI = grossMonthly > 0 ? (monthlyDebts + recMonthly) / grossMonthly : 0;
    const shortfall = Math.max(0, recDown - saved);

    let explanation: string;
    if (dtiRequiredPct !== null) {
      explanation = `Lenders cap your total debt-to-income at 43%. To bring a mortgage on a ${fmt(targetPrice)} home inside that limit, you need to put down at least ${recommendedPct}% (${fmt(recDown)}) — a smaller down payment wouldn't qualify for this price.`;
    } else if (recommendedPct >= 20 && recDown <= saved) {
      explanation = `Putting 20% down means you skip private mortgage insurance entirely — that's typically $100–$300/mo. Lenders also reserve their best interest rates for borrowers at this threshold, which over 30 years can save tens of thousands.`;
    } else if (recommendedPct >= 20) {
      explanation = `Putting 20% down means you skip private mortgage insurance entirely — that's typically $100–$300/mo. Lenders also reserve their best interest rates for borrowers at this threshold, which over 30 years can save tens of thousands.`;
    } else if (recDown <= saved) {
      explanation = `${recommendedPct}% (${fmt(recDown)}) is the smallest down payment that keeps your debt-to-income inside the 43% lender cap (yours would be ${(recDTI * 100).toFixed(0)}%) — and it fits within your current savings of ${fmt(saved)}, leaving more cash on hand after closing.`;
    } else {
      explanation = `${recommendedPct}% (${fmt(recDown)}) is the smallest down payment that keeps your debt-to-income inside the 43% lender cap (yours would be ${(recDTI * 100).toFixed(0)}%). You're about ${fmt(shortfall)} short of that today — that's the gap your savings plan will close.`;
    }

    return (
      <Question
        kicker="Down payment goal"
        title="How much do you want to put down?"
        sub="Lenders qualify you on debt-to-income, not just savings. We'll factor in your income, your debts, and the home price to flag what actually works."
      >
        <div
          style={{
            marginTop: 4,
            marginBottom: 18,
            padding: "16px 16px 14px",
            border: `1px solid ${C.ink}`,
            background: C.cream,
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: C.inkMute,
            }}
          >
            Estimated home price · {zd.city}
          </div>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 38,
              lineHeight: 1.05,
              color: C.ink,
              marginTop: 6,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmt(targetPrice)}
          </div>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontStyle: "italic",
              fontSize: 13,
              color: C.inkSoft,
              marginTop: 6,
            }}
          >
            Based on the features you picked.
          </div>
        </div>
        <Choices
          options={visibleOpts.map((b) => {
            const monthly = Math.round(calcMortgage(targetPrice, b.pct, mRate));
            const downAmt = Math.round(targetPrice * (b.pct / 100));
            const isRec = b.pct === recommendedPct;
            const recLabel =
              dtiRequiredPct !== null && recommendedPct > 20
                ? "★ Required"
                : "★ Recommended";
            return {
              val: String(b.pct),
              label: `${b.label} · ${fmt(downAmt)} · ${b.tag}`,
              tag: isRec ? recLabel : undefined,
              desc: `Monthly mortgage payment: ${fmt(monthly)} · ${b.desc}`,
            };
          })}
          value={d.downGoalPct !== null ? String(d.downGoalPct) : null}
          onSelect={(v) => set("downGoalPct", parseFloat(v as string))}
        />
        <div
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: "italic",
            fontSize: 14,
            lineHeight: 1.5,
            color: C.inkSoft,
            marginTop: 20,
            marginBottom: 8,
          }}
        >
          {explanation}
        </div>

        <Cta onClick={next} disabled={d.downGoalPct === null}>
          Continue
        </Cta>
      </Question>
    );
  }

  if (screen === "homeFeatures") {
    const Stepper = ({
      label,
      value,
      onChange,
      min,
      max,
      suffix,
    }: {
      label: string;
      value: number;
      onChange: (n: number) => void;
      min: number;
      max: number;
      suffix?: string;
    }) => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 0",
          borderBottom: `1px solid ${C.inkFaint}`,
        }}
      >
        <div
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 20,
            fontWeight: 600,
            color: C.ink,
          }}
        >
          {label}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => onChange(Math.max(min, value - 1))}
            style={{
              width: 34, height: 34, borderRadius: 0,
              border: `1.5px solid ${C.ink}`, background: "transparent",
              color: C.ink, fontSize: 18, cursor: "pointer",
            }}
          >−</button>
          <div
            style={{
              minWidth: 48, textAlign: "center",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 17, color: C.ink,
            }}
          >
            {value}{suffix}
          </div>
          <button
            onClick={() => onChange(Math.min(max, value + 1))}
            style={{
              width: 34, height: 34, borderRadius: 0,
              border: `1.5px solid ${C.ink}`, background: "transparent",
              color: C.ink, fontSize: 18, cursor: "pointer",
            }}
          >+</button>
        </div>
      </div>
    );

    const Pills = ({
      label,
      options,
      value,
      onSelect,
    }: {
      label: string;
      options: { val: string; label: string }[];
      value: string | null;
      onSelect: (v: string) => void;
    }) => (
      <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.inkFaint}` }}>
        <div
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 20, fontWeight: 600, color: C.ink, marginBottom: 10,
          }}
        >
          {label}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {options.map((o) => {
            const active = value === o.val;
            return (
              <button
                key={o.val}
                onClick={() => onSelect(o.val)}
                style={{
                  border: `1.5px solid ${C.ink}`,
                  background: active ? C.ink : "transparent",
                  color: active ? C.cream : C.ink,
                  padding: "7px 13px", fontSize: 13, cursor: "pointer", borderRadius: 0,
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    );

    // Priority chips: tap to cycle off → nice → must → off
    const PriorityList = ({
      items,
      values,
      onChange,
    }: {
      items: { val: string; label: string }[];
      values: Record<string, "nice" | "must">;
      onChange: (next: Record<string, "nice" | "must">) => void;
    }) => {
       const cycle = (v: string) => {
        const next = { ...values };
        if (next[v]) delete next[v];
        else next[v] = "nice";
        onChange(next);
      };
      return (
        <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.inkFaint}` }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {items.map((it) => {
              const state = values[it.val];
              const bg = state === "must" ? C.ember : state === "nice" ? C.ink : "transparent";
              const fg = state ? C.cream : C.ink;
              const border = state === "must" ? C.ember : C.ink;
              return (
                <button
                  key={it.val}
                  onClick={() => cycle(it.val)}
                  style={{
                    border: `1.5px solid ${border}`,
                    background: bg, color: fg,
                    padding: "8px 13px", fontSize: 13, cursor: "pointer",
                    borderRadius: 0, display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  {state === "must" && <span style={{ fontSize: 10, letterSpacing: 1 }}>★</span>}
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    };

    const SectionHeader = ({ title, hint }: { title: string; hint?: string }) => (
      <div style={{ marginTop: 28, marginBottom: 4 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
            color: C.inkMute,
          }}
        >
          {title}
        </div>
        {hint && (
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontStyle: "italic", fontSize: 14, color: C.inkSoft, marginTop: 4,
            }}
          >
            {hint}
          </div>
        )}
      </div>
    );

    const showLayout = ["starter", "single", "multi", "fixer"].includes(d.homeStyle ?? "");

    const lifestyleItems = [
      { val: "kids", label: "Space for kids" },
      { val: "dog", label: "Room for a dog" },
      { val: "host", label: "Hosting friends" },
      { val: "mornings", label: "Quiet mornings outside" },
      { val: "garden", label: "Gardening" },
      { val: "lowmaint", label: "Low maintenance" },
      { val: "office", label: "Home office" },
    ];
    const neighborhoodItems = [
      { val: "walk", label: "Walkable area" },
      { val: "schools", label: "Good schools" },
      { val: "commute", label: "Near work" },
      { val: "transit", label: "Public transit" },
      { val: "quiet", label: "Quiet suburb" },
      { val: "nature", label: "Parks & nature" },
      { val: "nightlife", label: "Restaurants & nightlife" },
      { val: "family", label: "Near family" },
    ];

    return (
      <Question
        kicker="Features"
        title="Picture the place."
        sub="Choose the bedrooms, baths, style, and features you'd like."
      >
        <div style={{ marginBottom: 28 }}>
          <SectionHeader title="Home basics" />
          <Stepper label="Bedrooms" value={d.beds} onChange={(n) => set("beds", n)} min={0} max={6} suffix={d.beds >= 6 ? "+" : ""} />
          <Stepper label="Bathrooms" value={d.baths} onChange={(n) => set("baths", n)} min={1} max={5} suffix={d.baths >= 5 ? "+" : ""} />
          {showLayout && (
            <Pills
              label="Style of home"
              options={[
                { val: "any", label: "No preference" },
                { val: "ranch", label: "Ranch / single-story" },
                { val: "twostory", label: "Two-story" },
                { val: "split", label: "Split-level" },
              ]}
              value={d.homeLayout ?? "any"}
              onSelect={(v) => set("homeLayout", v)}
            />
          )}
          <Pills
            label="Outdoor space"
            options={[
              { val: "none", label: "Not needed" },
              { val: "patio", label: "Patio / balcony" },
              { val: "yard", label: "Yard" },
            ]}
            value={d.outdoorSpace ?? "none"}
            onSelect={(v) => set("outdoorSpace", v)}
          />
          <Pills
            label="Parking"
            options={[
              { val: "street", label: "Street is fine" },
              { val: "driveway", label: "Driveway" },
              { val: "garage", label: "Garage" },
            ]}
            value={d.parking ?? "street"}
            onSelect={(v) => set("parking", v)}
          />

          <SectionHeader
            title="Lifestyle"
            hint="What would make it feel like home?"
          />
          <PriorityList
            items={lifestyleItems}
            values={d.lifestyle}
            onChange={(v) => set("lifestyle", v)}
          />

          <SectionHeader
            title="Neighborhood"
            hint="Where the home sits matters as much as the home itself."
          />
          <PriorityList
            items={neighborhoodItems}
            values={d.neighborhood}
            onChange={(v) => set("neighborhood", v)}
          />

        </div>
        <Cta onClick={next}>Continue</Cta>
      </Question>
    );
  }

  if (screen.startsWith("risk")) {
    const idx = Number(screen.replace("risk", ""));
    const q = RISK_QS[idx];
    const value = d.riskAnswers[idx];
    return (
      <Question kicker={`Risk · ${idx + 1} of 4`} title={q.q} sub={q.sub}>
        <Choices
          options={q.opts.map((o) => ({ val: o.val, label: o.label }))}
          value={value ?? null}
          onSelect={(v) =>
            set("riskAnswers", { ...d.riskAnswers, [idx]: v as number })
          }
        />
        <Cta onClick={next} disabled={value === undefined}>
          Continue
        </Cta>
      </Question>
    );
  }

  if (screen.startsWith("fact")) {
    const f = FACTS[screen as keyof typeof FACTS];
    if (!f) return null;
    return <FactPage {...f} onNext={next} />;
  }

  if (screen.startsWith("intro")) {
    const i = INTROS[screen as keyof typeof INTROS];
    if (!i) return null;
    return <IntroPage {...i} onNext={next} />;
  }

  if (screen === "calculating") return <CalculatingScreen onDone={next} />;

  if (screen === "dashboard") return <Report d={d} />;

  return null;
}

// ── Welcome ──────────────────────────────────────────────────────────────────
function Welcome({ onStart }: { onStart: () => void }) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [homePrice, setHomePrice] = useState(540000);
  const [currentSavings, setCurrentSavings] = useState(22680);
  const [monthlyContribution, setMonthlyContribution] = useState(1200);

  const downPaymentTarget = Math.max(1, Math.round(homePrice * 0.1));
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((currentSavings / downPaymentTarget) * 100)),
  );
  const remainingToGoal = Math.max(0, downPaymentTarget - currentSavings);
  const monthsRemaining =
    remainingToGoal === 0
      ? 0
      : monthlyContribution > 0
        ? Math.ceil(remainingToGoal / monthlyContribution)
        : Infinity;
  // Defer the date label to after mount so SSR and CSR markup match
  // (otherwise `new Date()` can differ across month boundaries).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const targetDateLabel = useMemo(() => {
    if (!mounted) return "—";
    if (remainingToGoal === 0) return "Today";
    if (!isFinite(monthsRemaining)) return "—";
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsRemaining, 1));
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }, [mounted, remainingToGoal, monthsRemaining]);

  const bumpMonthsSaved = (() => {
    if (remainingToGoal === 0 || !isFinite(monthsRemaining)) return 0;
    const bumped = Math.ceil(remainingToGoal / (monthlyContribution + 250));
    return Math.max(0, monthsRemaining - bumped);
  })();


  const serif = "'Instrument Serif', 'Cormorant Garamond', Georgia, serif";
  const sans = "'Work Sans', 'Inter', system-ui, sans-serif";
  const mono = "'JetBrains Mono', monospace";

  const scrollTo = (id: string) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const monoLabel: React.CSSProperties = {
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    fontWeight: 500,
  };

  const navLink: React.CSSProperties = {
    ...monoLabel,
    color: C.ink,
    textDecoration: "none",
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: 0,
  };

  return (
    <div
      style={{
        background: C.paper,
        color: C.ink,
        fontFamily: sans,
        minHeight: "100vh",
      }}
    >
      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "26px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: serif,
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}
        >
          Keystone<span style={{ color: C.ember }}>.</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <button
            onClick={() => scrollTo("how-it-works")}
            style={{ ...navLink, display: "none" }}
            className="ks-desktop-only"
          >
            How it works
          </button>
          <button
            onClick={() => scrollTo("pricing")}
            style={{ ...navLink, display: "none" }}
            className="ks-desktop-only"
          >
            Pricing
          </button>
          <Link to="/login" style={{ ...navLink, color: C.ember }}>
            Sign in
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "32px 24px 80px",
        }}
      >
        <div
          className="ks-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 56,
            alignItems: "center",
          }}
        >
          {/* LEFT: Editorial copy + CTA */}
          <div>
            <div
              style={{
                ...monoLabel,
                display: "inline-block",
                padding: "6px 12px",
                border: `1px solid rgba(26,26,26,0.18)`,
                borderRadius: 999,
                color: C.inkSoft,
                marginBottom: 28,
              }}
            >
              Invest your way home
            </div>

            <h1
              style={{
                fontFamily: serif,
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: "clamp(54px, 9vw, 104px)",
                lineHeight: 0.9,
                letterSpacing: "-0.03em",
                margin: "0 0 28px",
                color: C.ink,
              }}
            >
              Your down payment, working harder.
            </h1>

            <p
              style={{
                fontFamily: sans,
                fontWeight: 300,
                fontSize: 20,
                lineHeight: 1.5,
                color: "rgba(26,26,26,0.72)",
                maxWidth: 460,
                margin: "0 0 32px",
              }}
            >
              Stop parking your down payment in a savings account. Invest it the
              right way and reach your goal years sooner.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
              }}
            >
              <button
                onClick={onStart}
                style={{
                  background: C.ink,
                  color: C.paper,
                  border: "none",
                  padding: "18px 28px",
                  fontFamily: mono,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = C.ember)}
                onMouseOut={(e) => (e.currentTarget.style.background = C.ink)}
              >
                Build my plan →
              </button>
              <Link
                to="/example"
                style={{
                  background: "transparent",
                  color: C.ink,
                  border: `1px solid ${C.ink}`,
                  padding: "18px 28px",
                  fontFamily: mono,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  textDecoration: "none",
                  transition: "background 0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = C.paperDeep)
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                See an example
              </Link>
            </div>

            <div
              style={{
                marginTop: 28,
                display: "flex",
                gap: 18,
                ...monoLabel,
                color: C.inkFaint,
              }}
            >
              <span>~ 2 minutes</span>
              <span>·</span>
              <span>Free plan preview</span>
            </div>
          </div>

          {/* RIGHT: Product peek — plan card with soft rotation */}
          <div style={{ position: "relative", padding: "20px 0" }}>
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                bottom: -32,
                left: -24,
                width: 240,
                height: 240,
                background: C.paperDeep,
                opacity: 0.7,
                zIndex: 0,
              }}
            />
            <div
              style={{
                position: "relative",
                zIndex: 1,
                background: "#ffffff",
                border: `1px solid ${C.paperDeep}`,
                boxShadow: "0 30px 60px -20px rgba(26,26,26,0.25)",
                padding: 36,
                transform: "rotate(2deg)",
                transition: "transform 0.5s ease",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.transform = "rotate(0deg)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.transform = "rotate(2deg)")
              }
            >
              <div
                style={{
                  ...monoLabel,
                  color: C.ember,
                  marginBottom: 28,
                }}
              >
                Your projection
              </div>

              {(() => {
                const numInputStyle: React.CSSProperties = {
                  fontFamily: serif,
                  fontSize: 32,
                  lineHeight: 1,
                  background: "transparent",
                  border: "none",
                  borderBottom: `1px dashed ${C.inkFaint}`,
                  outline: "none",
                  padding: "2px 0",
                  width: "100%",
                  color: C.ink,
                  WebkitAppearance: "none",
                  MozAppearance: "textfield",
                };
                const labelStyle: React.CSSProperties = {
                  fontSize: 13,
                  color: "rgba(26,26,26,0.5)",
                  marginBottom: 4,
                };
                const fieldRow: React.CSSProperties = {
                  display: "flex",
                  alignItems: "baseline",
                  gap: 4,
                };
                return (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        borderBottom: `1px solid ${C.paper}`,
                        paddingBottom: 18,
                        marginBottom: 24,
                        gap: 16,
                      }}
                    >
                      <div>
                        <label htmlFor="ks-demo-price" style={labelStyle}>
                          Estimated home price
                        </label>
                        <div style={fieldRow}>
                          <span style={{ fontFamily: serif, fontSize: 32, lineHeight: 1 }}>$</span>
                          <input
                            id="ks-demo-price"
                            type="number"
                            min={50000}
                            step={5000}
                            value={homePrice}
                            onChange={(e) => setHomePrice(Math.max(0, Number(e.target.value) || 0))}
                            style={numInputStyle}
                          />
                        </div>
                      </div>
                      <div>
                        <div style={{ ...labelStyle, textAlign: "right" }}>Target date</div>
                        <div
                          style={{
                            fontFamily: serif,
                            fontStyle: "italic",
                            fontSize: 32,
                            lineHeight: 1,
                            textAlign: "right",
                          }}
                        >
                          {targetDateLabel}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          ...monoLabel,
                          marginBottom: 10,
                        }}
                      >
                        <span>Savings progress</span>
                        <span>{progressPct}%</span>
                      </div>
                      <div style={{ height: 8, background: C.paper, width: "100%" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${progressPct}%`,
                            background: C.ember,
                            transition: "width 0.25s ease",
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 16,
                        marginBottom: 24,
                      }}
                    >
                      <div>
                        <label htmlFor="ks-demo-saved" style={labelStyle}>
                          Saved so far
                        </label>
                        <div style={fieldRow}>
                          <span style={{ fontFamily: serif, fontSize: 22, lineHeight: 1 }}>$</span>
                          <input
                            id="ks-demo-saved"
                            type="number"
                            min={0}
                            step={500}
                            value={currentSavings}
                            onChange={(e) =>
                              setCurrentSavings(Math.max(0, Number(e.target.value) || 0))
                            }
                            style={{ ...numInputStyle, fontSize: 22 }}
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="ks-demo-monthly"
                          style={{ ...labelStyle, textAlign: "right", display: "block" }}
                        >
                          Monthly contribution
                        </label>
                        <div style={{ ...fieldRow, justifyContent: "flex-end" }}>
                          <span style={{ fontFamily: serif, fontSize: 22, lineHeight: 1 }}>$</span>
                          <input
                            id="ks-demo-monthly"
                            type="number"
                            min={0}
                            step={50}
                            value={monthlyContribution}
                            onChange={(e) =>
                              setMonthlyContribution(Math.max(0, Number(e.target.value) || 0))
                            }
                            style={{ ...numInputStyle, fontSize: 22, textAlign: "right" }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ background: C.paper, padding: 20 }}>
                      <div
                        style={{
                          fontFamily: serif,
                          fontStyle: "italic",
                          fontSize: 15,
                          color: "rgba(26,26,26,0.65)",
                          marginBottom: 6,
                        }}
                      >
                        Note from Keystone:
                      </div>
                      <p
                        style={{
                          fontSize: 14,
                          lineHeight: 1.55,
                          margin: 0,
                          color: C.ink,
                        }}
                      >
                        {remainingToGoal === 0
                          ? "You've already hit a 10% down payment on this price. Time to start touring."
                          : !isFinite(monthsRemaining)
                            ? "Add a monthly contribution to see how fast you'll reach your goal."
                            : bumpMonthsSaved > 0
                              ? `At this pace you'll have a 10% down payment in ${monthsRemaining} month${monthsRemaining === 1 ? "" : "s"}. Adding $250/month moves your purchase date up by ${bumpMonthsSaved} month${bumpMonthsSaved === 1 ? "" : "s"}.`
                              : `At this pace you'll have a 10% down payment in ${monthsRemaining} month${monthsRemaining === 1 ? "" : "s"}.`}
                      </p>
                    </div>
                  </>
                );
              })()}

            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section
        id="how-it-works"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "96px 24px",
        }}
      >
        <div style={{ marginBottom: 64 }}>
          <div style={{ ...monoLabel, color: C.ember, marginBottom: 14 }}>
            Process
          </div>
          <h2
            style={{
              fontFamily: serif,
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "clamp(40px, 6vw, 72px)",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Everything you need
            <br />
            to get the keys.
          </h2>
        </div>
        <div
          className="ks-process"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 48,
          }}
        >
          {[
            {
              n: "01.",
              t: "The Audit",
              p: "See exactly where you stand today across cash, savings, and brokerage accounts. No spreadsheets required.",
            },
            {
              n: "02.",
              t: "The Plan",
              p: "Pick a target home and we model save-vs-invest side by side, so you see how many years investing shaves off your timeline.",
            },
            {
              n: "03.",
              t: "The Purchase",
              p: "When you're ready, we match you with lenders and agents specialized in your target market.",
            },
          ].map((s) => (
            <div key={s.n} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div
                style={{
                  fontFamily: serif,
                  fontSize: 36,
                  color: C.ember,
                  lineHeight: 1,
                }}
              >
                {s.n}
              </div>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                {s.t}
              </h3>
              <p
                style={{
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: "rgba(26,26,26,0.7)",
                  margin: 0,
                }}
              >
                {s.p}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── DASHBOARD MOMENT ───────────────────────────────── */}
      <section
        style={{
          background: C.ink,
          color: C.paper,
          padding: "96px 24px",
          overflow: "hidden",
        }}
      >
        <div
          className="ks-dash"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 64,
            alignItems: "center",
          }}
        >
          {/* Mock chart */}
          <div
            style={{
              background: "rgba(245,239,230,0.04)",
              border: "1px solid rgba(245,239,230,0.1)",
              borderRadius: 8,
              padding: 28,
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: C.ember,
                }}
              />
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.2)",
                }}
              />
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.2)",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 10,
                height: 220,
                marginBottom: 24,
              }}
            >
              {[
                { h: 20, bg: "rgba(255,255,255,0.1)", marker: false },
                { h: 35, bg: "rgba(255,255,255,0.1)", marker: false },
                { h: 45, bg: "rgba(255,255,255,0.1)", marker: false },
                { h: 55, bg: "rgba(255,255,255,0.1)", marker: false },
                { h: 75, bg: C.ember, marker: true },
                { h: 85, bg: "rgba(255,255,255,0.2)", marker: false },
              ].map((b, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${b.h}%`,
                    background: b.bg,
                    position: "relative",
                  }}
                >
                  {b.marker && (
                    <div
                      style={{
                        position: "absolute",
                        top: -34,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: C.ember,
                        color: C.paper,
                        padding: "4px 10px",
                        fontFamily: mono,
                        fontSize: 9,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Buying window
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                ...monoLabel,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              <span>2024</span>
              <span>2025</span>
              <span>2026</span>
              <span>2027</span>
            </div>
          </div>

          <div>
            <h2
              style={{
                fontFamily: serif,
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: "clamp(36px, 5.5vw, 64px)",
                lineHeight: 1.02,
                letterSpacing: "-0.02em",
                margin: "0 0 24px",
              }}
            >
              Watch your timeline shrink.
            </h2>
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.6,
                color: "rgba(245,239,230,0.65)",
                margin: "0 0 28px",
                maxWidth: 460,
              }}
            >
              Invest your down payment in a portfolio matched to your timeline.
              As markets move and you contribute, your buy date updates in real
              time.
            </p>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {[
                "Save vs. invest, side by side",
                "Risk matched to your timeline",
                "Live buy-date forecasting",
              ].map((t) => (
                <li
                  key={t}
                  style={{
                    ...monoLabel,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span style={{ color: C.ember }}>+</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── PRICING TEASER ─────────────────────────────────── */}
      <section
        id="pricing"
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "96px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ ...monoLabel, color: C.ember, marginBottom: 14 }}>
          Fair pricing
        </div>
        <h2
          style={{
            fontFamily: serif,
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: "clamp(40px, 6vw, 60px)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            margin: "0 0 18px",
          }}
        >
          Simple pricing. Serious progress.
        </h2>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.55,
            color: "rgba(26,26,26,0.6)",
            margin: "0 auto 44px",
            maxWidth: 520,
          }}
        >
          7-day free trial.
        </p>
        <div
          style={{
            padding: 48,
            border: `1px solid ${C.ink}`,
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <div style={{ ...monoLabel }}>Keystone Plus</div>
          <div style={{ fontFamily: serif, fontSize: 64, lineHeight: 1 }}>
            $5
            <span style={{ fontSize: 22, color: "rgba(26,26,26,0.4)" }}>/mo</span>
          </div>
          <Link
            to="/pricing"
            style={{
              background: C.ink,
              color: C.paper,
              border: "none",
              padding: "20px",
              fontFamily: mono,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "background 0.2s",
              textDecoration: "none",
              textAlign: "center",
              display: "block",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = C.ember)}
            onMouseOut={(e) => (e.currentTarget.style.background = C.ink)}
          >
            Compare plans
          </Link>
          <p
            style={{
              fontSize: 12,
              color: "rgba(26,26,26,0.45)",
              margin: 0,
              textAlign: "center",
            }}
          >
            Bonus: Pro ($11/mo) adds Auto-Investing.
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section style={{ background: C.paperDeep, padding: "96px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: serif,
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "clamp(32px, 5vw, 48px)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              margin: "0 0 40px",
            }}
          >
            Frequently asked questions
          </h2>
          <div>
            {[
              {
                q: "How is this different from a savings account?",
                a: "The average savings account earns ~0.38%. Keystone builds a structured plan around your real timeline, target market prices, and risk tolerance — so you arrive at closing with the right number, not just a balance.",
              },
              {
                q: "Isn't investing my down payment risky?",
                a: "We match your portfolio to your timeline — the closer you get to buying, the more we shift toward stability. You're not gambling your down payment; you're putting it to work appropriately.",
              },
              {
                q: "What if home prices in my area go up?",
                a: "Your plan recalibrates as conditions shift. We track local market data so your projection reflects what a home actually costs today — not last year.",
              },
            ].map((f, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={f.q}
                  style={{ borderTop: `1px solid rgba(26,26,26,0.12)` }}
                >
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    style={{
                      width: "100%",
                      background: "none",
                      border: "none",
                      padding: "22px 0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: mono,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: C.ink,
                    }}
                  >
                    <span>{f.q}</span>
                    <span style={{ fontSize: 20, color: C.ember }}>
                      {open ? "–" : "+"}
                    </span>
                  </button>
                  {open && (
                    <p
                      style={{
                        fontSize: 16,
                        lineHeight: 1.6,
                        color: "rgba(26,26,26,0.72)",
                        margin: "0 0 24px",
                        maxWidth: 600,
                      }}
                    >
                      {f.a}
                    </p>
                  )}
                </div>
              );
            })}
            <div style={{ borderTop: `1px solid rgba(26,26,26,0.12)` }} />
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ─────────────────────────────────────── */}
      <footer
        style={{
          padding: "120px 24px 64px",
          textAlign: "center",
          background: C.paper,
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: serif,
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "clamp(54px, 9vw, 104px)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              margin: "0 0 48px",
            }}
          >
            Ready to own your tomorrow?
          </h2>
          <button
            onClick={onStart}
            style={{
              background: C.ember,
              color: "#ffffff",
              border: "none",
              padding: "24px 48px",
              fontFamily: mono,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: "0 16px 32px -12px rgba(196,69,45,0.45)",
              transition: "transform 0.2s",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.transform = "translateY(-2px)")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.transform = "translateY(0)")
            }
          >
            Build my plan today
          </button>
          <div
            style={{
              marginTop: 88,
              paddingTop: 32,
              borderTop: `1px solid rgba(26,26,26,0.1)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              ...monoLabel,
              color: "rgba(26,26,26,0.4)",
            }}
          >
            <span>© 2026 Keystone Financial Technologies</span>
            <div style={{ display: "flex", gap: 28 }}>
              <Link to="/login" style={{ color: "inherit", textDecoration: "none" }}>
                Sign in
              </Link>
              <span>Privacy</span>
              <span>Terms</span>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @media (min-width: 760px) {
          .ks-hero-grid { grid-template-columns: 1.05fr 1fr !important; gap: 80px !important; }
          .ks-process { grid-template-columns: repeat(3, 1fr) !important; gap: 56px !important; }
          .ks-dash { grid-template-columns: 1fr 1fr !important; }
          .ks-dash > div:last-child { order: -1; }
          .ks-proof { flex-direction: row !important; }
          .ks-desktop-only { display: inline-block !important; }
        }
        @media (min-width: 1000px) {
          .ks-dash > div:last-child { order: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Question scaffolding ─────────────────────────────────────────────────────
function Question({
  kicker,
  title,
  sub,
  children,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ paddingTop: 6 }}>
      {kicker && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.ember,
            marginBottom: 14,
          }}
        >
          — {kicker}
        </div>
      )}
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 400,
          fontSize: 34,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          margin: "0 0 12px",
          color: C.ink,
        }}
      >
        {title}
      </h2>
      {sub && (
        <p
          style={{
            fontSize: 14,
            color: C.inkMute,
            lineHeight: 1.55,
            margin: "0 0 32px",
            maxWidth: 380,
          }}
        >
          {sub}
        </p>
      )}
      {!sub && <div style={{ height: 28 }} />}
      {children}
    </div>
  );
}

// ── CTA ──────────────────────────────────────────────────────────────────────
function Cta({
  children,
  onClick,
  disabled,
  large,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  large?: boolean;
}) {
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      style={{
        background: disabled ? "transparent" : C.ink,
        color: disabled ? C.inkFaint : C.cream,
        border: `1.5px solid ${disabled ? C.inkFaint : C.ink}`,
        borderRadius: 0,
        padding: large ? "18px 28px" : "14px 22px",
        fontSize: large ? 14 : 13,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        width: "100%",
        transition: "all 0.18s",
        position: "relative",
      }}
    >
      {children}
      <span style={{ marginLeft: 10 }}>→</span>
    </button>
  );
}

// ── Slider ───────────────────────────────────────────────────────────────────
function Slider({
  value,
  min,
  max,
  step,
  format,
  onChange,
  unit,
  maxNote,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  unit?: string;
  maxNote?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 36 }}>
      <div
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 400,
          fontSize: 56,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          color: C.ink,
          marginBottom: 4,
        }}
      >
        {format(value)}
      </div>
      {unit && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.inkMute,
            marginBottom: 28,
          }}
        >
          {unit}
        </div>
      )}
      {!unit && <div style={{ height: 22 }} />}
      <div style={{ position: "relative", height: 36 }}>
        {/* Track (rounded pill) */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 14,
            height: 8,
            borderRadius: 999,
            background: "rgba(26,26,26,0.10)",
          }}
        />
        {/* Filled portion */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 14,
            height: 8,
            width: `${pct}%`,
            borderRadius: 999,
            background: C.ink,
            transition: "width 0.12s ease-out",
          }}
        />
        {/* Circular thumb */}
        <div
          style={{
            position: "absolute",
            left: `${pct}%`,
            top: 4,
            transform: "translateX(-50%)",
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: C.ember,
            border: `2px solid ${C.ink}`,
            boxShadow: "0 4px 10px rgba(26,26,26,0.18)",
            pointerEvents: "none",
            transition: "transform 0.12s ease-out",
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: "pointer",
            margin: 0,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 10,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: C.inkFaint,
          letterSpacing: "0.05em",
        }}
      >
        <span>{format(min)}</span>
        <span>
          {format(max)}
          {maxNote && <span style={{ color: C.ember, marginLeft: 2 }}>*</span>}
        </span>
      </div>
      {maxNote && (
        <div
          style={{
            marginTop: 10,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            lineHeight: 1.5,
            letterSpacing: "0.06em",
            color: C.inkMute,
            textTransform: "none",
          }}
        >
          <span style={{ color: C.ember }}>*</span> {maxNote}
        </div>
      )}
    </div>
  );
}

// ── Choices list ─────────────────────────────────────────────────────────────
function Choices({
  options,
  value,
  onSelect,
}: {
  options: { val: number | string; label: string; tag?: string; desc?: string }[];
  value: number | string | null;
  onSelect: (v: number | string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 28 }}>
      {options.map((o, i) => {
        const active = value === o.val;
        return (
          <button
            key={`${o.val}-${i}`}
            onClick={() => onSelect(o.val)}
            style={{
              background: active ? C.ink : "transparent",
              color: active ? C.cream : C.ink,
              border: "none",
              borderTop: `1px solid ${C.ink}`,
              borderBottom: i === options.length - 1 ? `1px solid ${C.ink}` : "none",
              padding: "18px 4px",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              transition: "all 0.16s",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 20,
                  fontWeight: 500,
                  marginBottom: o.desc ? 4 : 0,
                }}
              >
                {o.label}
              </div>
              {o.desc && (
                <div
                  style={{
                    fontSize: 12,
                    color: active ? "rgba(251,247,240,0.6)" : C.inkMute,
                    lineHeight: 1.4,
                  }}
                >
                  {o.desc}
                </div>
              )}
            </div>
            {o.tag && (
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontWeight: /recommended|required/i.test(o.tag) ? 800 : 400,
                  color: /recommended|required/i.test(o.tag)
                    ? (active ? "#FBF7F0" : C.ink)
                    : (active ? "rgba(251,247,240,0.6)" : C.inkFaint),
                  whiteSpace: "nowrap",
                }}
              >
                {o.tag}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ZipCallout({ city, avg }: { city: string; avg: number }) {
  return (
    <div
      style={{
        borderTop: `1px solid ${C.ink}`,
        borderBottom: `1px solid ${C.ink}`,
        padding: "14px 0",
        marginBottom: 28,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.inkFaint,
            marginBottom: 4,
          }}
        >
          Avg home price
        </div>
        <div
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 16,
            color: C.ink,
          }}
        >
          {city}
        </div>
      </div>
      <div
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 28,
          color: C.ember,
        }}
      >
        {fmt(avg)}
      </div>
    </div>
  );
}

// ── Fact page ────────────────────────────────────────────────────────────────
function FactPage({
  kicker,
  fact,
  context,
  source,
  onNext,
}: {
  kicker: string;
  fact: string;
  context: string;
  source: string;
  onNext: () => void;
}) {
  return (
    <div style={{ paddingTop: 30 }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.ember,
          marginBottom: 24,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          height: 1,
          background: C.ink,
          marginBottom: 32,
        }}
      />
      <p
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 400,
          fontSize: 38,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          margin: "0 0 24px",
          color: C.ink,
        }}
      >
        {fact}
      </p>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: C.inkSoft,
          margin: "0 0 28px",
          maxWidth: 420,
        }}
      >
        {context}
      </p>
      <p
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.1em",
          color: C.inkFaint,
          margin: "0 0 40px",
        }}
      >
        — {source}
      </p>
      <Cta onClick={onNext}>Continue</Cta>
    </div>
  );
}

function IntroPage({
  chapter,
  kicker,
  title,
  body,
  onNext,
}: {
  chapter: string;
  kicker: string;
  title: string;
  body: string;
  onNext: () => void;
}) {
  return (
    <div style={{ paddingTop: 30 }}>
      {false && chapter && <div />}
      <div
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: 16,
          color: C.inkMute,
          marginBottom: 28,
        }}
      >
        — {kicker}
      </div>
      <div style={{ height: 1, background: C.ink, marginBottom: 32 }} />
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 400,
          fontSize: 36,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          margin: "0 0 22px",
          color: C.ink,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: C.inkSoft,
          margin: "0 0 40px",
          maxWidth: 420,
        }}
      >
        {body}
      </p>
      <Cta onClick={onNext}>Begin</Cta>
    </div>
  );
}

function ZipScreen({
  d,
  set,
  next,
}: {
  d: Data;
  set: <K extends keyof Data>(k: K, v: Data[K]) => void;
  next: () => void;
}) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<"All" | "Northeast" | "Midwest" | "South" | "West">("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return US_STATES.filter((s) => {
      if (region !== "All" && s.region !== region) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.code.toLowerCase().startsWith(q);
    });
  }, [query, region]);

  const selected = d.zip ? US_STATES.find((s) => s.code === d.zip) : null;

  const pick = (code: string) => {
    set("zip", code);
    set("zipData", priceByState(code));
  };

  return (
    <Question
      kicker="The home"
      title="Where you're buying, and what you're buying."
      sub="Pick the state where you're house-hunting — that sets your local price benchmark. We'll cover home style and timeline next."
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {(["All", "Northeast", "Midwest", "South", "West"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegion(r)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: `1px solid ${region === r ? C.ink : C.inkFaint}`,
              background: region === r ? C.ink : "transparent",
              color: region === r ? C.paper : C.inkSoft,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {r}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Search a state…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: `1.5px solid ${C.ink}`,
          padding: "10px 0",
          fontSize: 16,
          color: C.ink,
          outline: "none",
          marginBottom: 16,
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
          gap: 6,
          marginBottom: 18,
          maxHeight: 320,
          overflowY: "auto",
        }}
      >
        {filtered.map((s) => {
          const active = d.zip === s.code;
          return (
            <button
              key={s.code}
              type="button"
              onClick={() => pick(s.code)}
              style={{
                padding: "10px 8px",
                border: `1px solid ${active ? C.ink : C.inkFaint}`,
                background: active ? C.ink : "transparent",
                color: active ? C.paper : C.ink,
                fontSize: 12,
                fontWeight: 500,
                textAlign: "left",
                cursor: "pointer",
                lineHeight: 1.2,
              }}
            >
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, opacity: 0.7, letterSpacing: "0.1em" }}>
                {s.code}
              </div>
              <div style={{ marginTop: 2 }}>{s.name}</div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", color: C.inkMute, fontSize: 13, padding: "12px 0" }}>
            No states match.
          </div>
        )}
      </div>

      {selected && (
        <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 18, fontStyle: "italic" }}>
          {selected.name} · typical median ~${(selected.median / 1000).toFixed(0)}k
        </div>
      )}

      <Cta onClick={next} disabled={!d.zip}>
        Continue
      </Cta>
    </Question>
  );
}

// ── Money input ──────────────────────────────────────────────────────────────
// AdvancedAssumptionsScreen removed — backend derives assumptions from the user's metro.
// Plus members can override defaults from the dashboard "Assumptions" panel.

function MoneyInput({
  label,
  unit,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState<string>(value ? String(value) : "");
  useEffect(() => {
    setText(value ? String(value) : "");
  }, [value]);
  const display =
    text === "" ? "" : Number(text).toLocaleString("en-US");
  return (
    <label style={{ display: "block", marginBottom: 22 }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: C.inkMute,
          marginBottom: 8,
        }}
      >
        {label}
        {unit && <span style={{ marginLeft: 8, opacity: 0.7 }}>· {unit}</span>}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderBottom: `1.5px solid ${C.ink}`,
          paddingBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 32,
            color: C.inkMute,
            marginRight: 6,
          }}
        >
          $
        </span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={display}
          placeholder={placeholder ?? "0"}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, "");
            setText(raw);
            onChange(raw === "" ? 0 : Number(raw));
          }}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 400,
            fontSize: 32,
            letterSpacing: "-0.02em",
            color: C.ink,
            padding: 0,
            minWidth: 0,
          }}
        />
      </div>
    </label>
  );
}

// ── Finances form (income / expenses / debt / saved) ────────────────────────
function FinancesForm({
  household = false,
  income,
  expenses,
  debt,
  saved,
  onIncome,
  onExpenses,
  onDebt,
  onSaved,
}: {
  household?: boolean;
  income: number;
  expenses: number;
  debt: number;
  saved: number;
  onIncome: (v: number) => void;
  onExpenses: (v: number) => void;
  onDebt: (v: number) => void;
  onSaved: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <FinanceField
        label={household ? "Total household gross annual income" : "Gross annual income"}
        hint={household
          ? "Combined pre-tax income for you and your partner — salary, wages, or 1099. We use this to size what lenders will offer."
          : "What you earn before taxes — salary, wages, or 1099 income. We use this to size what lenders will offer."}
        value={income}
        min={20000}
        max={household ? 600000 : 300000}
        step={1000}
        onChange={onIncome}
      />
      <FinanceField
        label={household ? "Total household monthly expenses" : "Monthly expenses"}
        hint={household
          ? "Combined must-pay monthly costs for the household: rent, utilities, groceries, transport, subscriptions. Skip the debt payments below."
          : "Your must-pay monthly costs: rent, utilities, groceries, transport, subscriptions. Skip the debt payments below."}
        value={expenses}
        min={0}
        max={household ? 25000 : 15000}
        step={50}
        onChange={onExpenses}
        unit="per month"
      />
      <FinanceField
        label={household ? "Total household monthly debt payments" : "Monthly debt payments"}
        hint={household
          ? "Combined minimums across both of you: credit cards, student loans, car payments, and any other recurring debt. Lenders weigh this heavily."
          : "Minimums on credit cards, student loans, car payments, and any other recurring debt. Lenders weigh this heavily."}
        value={debt}
        min={0}
        max={household ? 10000 : 5000}
        step={25}
        onChange={onDebt}
        unit="per month"
      />
      <FinanceField
        label={household ? "Total household savings for the home" : "Already saved for the home"}
        hint={household
          ? "Combined cash, savings, or investments either of you would put toward the down payment and closing costs."
          : "Cash, savings, or investments you'd put toward the down payment and closing costs."}
        value={saved}
        min={0}
        max={household ? 200000 : 100000}
        step={500}
        onChange={onSaved}
      />
    </div>
  );
}

function FinanceField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  unit,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: C.inkMute,
          marginBottom: 6,
        }}
      >
        {label}
        {unit && <span style={{ marginLeft: 8, opacity: 0.7 }}>· {unit}</span>}
      </div>
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.45,
          color: C.inkMute,
          marginBottom: 14,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontStyle: "italic",
        }}
      >
        {hint}
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        format={(v) => fmt(v)}
        onChange={onChange}
      />
    </div>
  );
}


function LimitReachedGate({ used, limit }: { used: number | null; limit: number | null }) {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "60px 24px", fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#1a1a1a" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "#c4452d", marginBottom: 16 }}>
        — Free scenario limit reached
      </div>
      <h1 style={{ fontWeight: 400, fontSize: 38, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 18px" }}>
        You've used {used ?? limit} of your {limit ?? 1} free scenario{(limit ?? 1) === 1 ? "" : "s"}.
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.5, color: "#3d3d3d", margin: "0 0 28px" }}>
        Upgrade to save unlimited scenarios — try different cities, timelines, down-payment percentages, or partner vs. solo — plus PDF export, themed reports, and email reminders.
      </p>
      <Link to="/pricing" style={{ display: "inline-block", padding: "14px 22px", background: "#1a1a1a", color: "#f5efe6", textDecoration: "none", borderRadius: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        See upgrade options →
      </Link>
      <div style={{ marginTop: 18, fontSize: 13, color: "#6b6b6b" }}>
        Already a member? <Link to="/login" style={{ color: "#c4452d" }}>Sign in</Link> to view your saved plans.
      </div>
    </div>
  );
}

function Report({ d }: { d: Data }) {
  const saveLead = useServerFn(upsertLead);
  const submit = useServerFn(submitPlan);
  const sub = useSubscription();
  const gate = useUpgradeGate();
  const [planId, setPlanId] = useState<string | null>(null);
  const [limitState, setLimitState] = useState<
    | { reason: "limit_reached"; used: number | null; limit: number | null }
    | null
  >(null);
  useEffect(() => {
    const email = (d.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) return;
    saveLead({
      data: { 
        email, 
        firstName: d.firstName.trim() || undefined,
        lastName: d.lastName.trim() || undefined,
        phone: d.phone.trim() || undefined,
        answers: d as unknown as Record<string, unknown>, 
        completed: true 
      },
    }).catch((err) => console.error("[saveLead:report]", err));
    submit({
      data: {
        email,
        firstName: d.firstName.trim() || undefined,
        lastName: d.lastName.trim() || undefined,
        phone: d.phone.trim() || undefined,
        answers: d as unknown as Record<string, unknown>,
        environment: getStripeEnvironment(),
      },
    })
      .then((res) => {
        if (!res.ok && res.reason === "limit_reached") {
          setLimitState({
            reason: "limit_reached",
            used: res.used,
            limit: res.limit,
          });
        } else if (res.ok && res.planId) {
          setPlanId(res.planId);
        }
      })
      .catch((err) => console.error("[submitPlan]", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (limitState) {
    return <LimitReachedGate used={limitState.used} limit={limitState.limit} />;
  }
  const zipData = d.zipData ?? { city: "your area", avg: 400000 };
  const styleIds = d.homeStyle ? [d.homeStyle] : [];
  const styleAdj = useMemo(() => styleAdjustments(styleIds), [d.homeStyle]);
  const avgPrice = Math.round(zipData.avg * computeFeatureMult(d));
  // User-selected down payment goal, floored to the style's min down.
  const candidate = d.downGoalPct ?? 9;
  const effectiveDownPct = Math.max(candidate, styleAdj.minDown);
  const downPayment = Math.round((avgPrice * effectiveDownPct) / 100);
  const months = d.timelineYears * 12;
  const risk = useMemo(() => deriveRisk(d.riskAnswers), [d.riskAnswers]);

  const hasPartner = d.hasPartner === true;
  const combinedIncome = d.income + (hasPartner ? d.partnerIncome : 0);
  const combinedExpenses = d.expenses + (hasPartner ? d.partnerExpenses : 0);
  const combinedDebt = d.debt + (hasPartner ? d.partnerDebt : 0);
  const qualifyingCredit =
    hasPartner && d.partnerCredit
      ? Math.min(d.credit ?? 700, d.partnerCredit)
      : d.credit ?? 700;

  const investedMonthly = calcRequiredMonthly(d.saved, downPayment, months, risk.rate);
  const savedOnlyMonthly = calcRequiredMonthly(d.saved, downPayment, months, 0);
  const paywallMonthsSooner = computeMonthsSooner(d.saved, downPayment, savedOnlyMonthly, months);

  const empAdjReady = combinedEmploymentAdjustment(
    d.employment,
    hasPartner ? d.partnerEmployment : null,
  );
  const mortgageRate =
    rateFromCredit(qualifyingCredit) +
    empAdjReady.rateAdd +
    rateAddFromDownPct(effectiveDownPct);
  const mortgage = calcMortgage(avgPrice, effectiveDownPct, mortgageRate);
  const derivedA = deriveAssumptions({ zip: d.zip });
  const taxIns = (avgPrice * (derivedA.propertyTaxRate + derivedA.insuranceRate)) / 12;
  const pmi =
    effectiveDownPct < 20
      ? (avgPrice * (1 - effectiveDownPct / 100) * 0.005) / 12
      : 0;
  const hoa = styleAdj.hoa;
  const reserve = styleAdj.reserve;
  const totalHousing = mortgage + taxIns + pmi + hoa + reserve;
  const monthlyIncome = combinedIncome / 12;
  const housingRatio = totalHousing / monthlyIncome;
  const verdict =
    housingRatio <= 0.45 ? "Affordable" : housingRatio <= 0.55 ? "A stretch" : "Difficult";
  const verdictTone =
    housingRatio <= 0.45 ? C.sage : housingRatio <= 0.55 ? C.gold : C.ember;

  const eFundMin = combinedExpenses * 3;
  const eFundOk = d.saved >= eFundMin;

  const creditScoreNorm = Math.max(
    0,
    Math.min(100, ((qualifyingCredit - 580) / (820 - 580)) * 100),
  );
  const qualifyingMonthlyIncome = (monthlyIncome * empAdjReady.incomeFactor) || 1;
  const dti = (combinedDebt + totalHousing) / qualifyingMonthlyIncome;
  const dtiScore = Math.max(0, Math.min(100, (1 - (dti - 0.45) / 0.2) * 100));
  const savingsScore = Math.max(0, Math.min(100, (d.saved / Math.max(downPayment, 1)) * 100));
  const timelineScore = Math.max(0, Math.min(100, (d.timelineYears / 5) * 100));
  const readiness = Math.round(
    creditScoreNorm * 0.3 + dtiScore * 0.3 + savingsScore * 0.25 + timelineScore * 0.15,
  );
  const readinessLabel =
    readiness >= 80
      ? "Ready to act"
      : readiness >= 60
        ? "Almost there"
        : readiness >= 40
          ? "Building toward it"
          : "Early days";

  const styleNames = HOME_STYLES.find((s) => s.id === d.homeStyle)?.label ?? "Your home";

  return (
    <div style={{ paddingTop: 8, paddingBottom: 40 }}>
      {/* Masthead */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <Wordmark small />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: C.inkFaint,
            }}
          >
            The Report
          </span>
        </div>
      </div>
      <div style={{ height: 1, background: C.ink, marginBottom: 18 }} />

      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.ember,
          marginBottom: 12,
        }}
      >
        Your plan, prepared
      </div>

      <h1
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 400,
          fontSize: 42,
          lineHeight: 1.02,
          letterSpacing: "-0.025em",
          margin: "0 0 14px",
          color: C.ink,
        }}
      >
        {styleNames || "Your home"}{" "}
        <em style={{ fontStyle: "italic", fontWeight: 600 }}>in</em>{" "}
        {zipData.city}.
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 0,
          borderTop: `1px solid ${C.ink}`,
          borderBottom: `1px solid ${C.ink}`,
          marginBottom: 36,
        }}
      >
        <Stat label="Est. price"  value={fmtCompact(avgPrice)} />
        <Stat label="Down"        value={`${effectiveDownPct}%`} divider />
        <Stat label="= deposit"   value={fmtCompact(downPayment)} divider />
      </div>

      {/* Section 1 — Save vs Invest */}
      {(() => {
        // User's chosen monthly contribution = the save-only figure shown on the timeline screen.
        const chosenMonthly = savedOnlyMonthly;
        const monthsToTarget = (rate: number): number => {
          const T = downPayment;
          const S = d.saved;
          const P = chosenMonthly;
          if (S >= T) return 0;
          if (P <= 0) return Infinity;
          if (rate === 0) return Math.ceil((T - S) / P);
          const r = rate / 12;
          const num = T + (P * 12) / rate;
          const den = S + (P * 12) / rate;
          if (num <= 0 || den <= 0) return Infinity;
          return Math.ceil(Math.log(num / den) / Math.log(1 + r));
        };
        const fmtDuration = (n: number): string => {
          if (!isFinite(n)) return "—";
          if (n <= 0) return "Already there";
          const y = Math.floor(n / 12);
          const m = n % 12;
          if (y === 0) return `${m} mo`;
          if (m === 0) return `${y} ${y === 1 ? "yr" : "yrs"}`;
          return `${y} ${y === 1 ? "yr" : "yrs"} ${m} mo`;
        };
        const baseMonths = d.timelineYears * 12;
        const investedMonths = monthsToTarget(risk.rate);
        const monthsSaved = Math.max(0, baseMonths - investedMonths);
        return (
      <Section number="01" title="Save, or invest?">
        <p style={SubP}>
          Keeping the same{" "}
          <em style={{ fontStyle: "italic" }}>{fmt(chosenMonthly)}/mo</em> you
          picked, here's how much sooner investing gets you to{" "}
          {fmt(downPayment)}.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
            background: C.ink,
            border: `1px solid ${C.ink}`,
            margin: "20px 0 18px",
          }}
        >
          <PathCard
            kicker="Path A · Save"
            value={fmtDuration(baseMonths)}
            unit={`at ${fmt(chosenMonthly)}/mo`}
            note="Cash in a regular account. No growth assumed."
          />
          <PathCard
            kicker={`Path B · ${risk.label}`}
            value={fmtDuration(investedMonths)}
            unit={`at ${fmt(chosenMonthly)}/mo`}
            note={`Invested at ~${(risk.rate * 100).toFixed(0)}% annually.`}
            highlight
          />
        </div>

        {monthsSaved > 0 && (
          <p
            style={{
              ...SubP,
              borderLeft: `2px solid ${C.ember}`,
              paddingLeft: 14,
              fontStyle: "italic",
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 15,
              color: C.inkSoft,
            }}
          >
            Investing gets you there{" "}
            <strong style={{ color: C.ember, fontStyle: "normal" }}>
              {fmtDuration(monthsSaved)} sooner
            </strong>{" "}
            — same monthly contribution, compounding does the rest.
          </p>
        )}

        <div style={{ marginTop: 18 }}>
          <Subhead>All three risk profiles</Subhead>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <tbody>
              {STRATEGIES.map((s) => {
                const n = monthsToTarget(s.rate);
                const isMatch = s.label === risk.label;
                return (
                  <tr
                    key={s.label}
                    style={{ borderBottom: `1px solid ${C.paperDeep}` }}
                  >
                    <td
                      style={{
                        padding: "12px 0",
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: 16,
                        fontWeight: isMatch ? 600 : 400,
                        color: isMatch ? C.ember : C.ink,
                      }}
                    >
                      {isMatch && "→ "}
                      {s.label}
                    </td>
                    <td
                      style={{
                        padding: "12px 0",
                        fontSize: 11,
                        color: C.inkMute,
                      }}
                    >
                      {(s.rate * 100).toFixed(0)}%
                    </td>
                    <td
                      style={{
                        padding: "12px 0",
                        textAlign: "right",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 13,
                        color: isMatch ? C.ink : C.inkMute,
                        fontWeight: isMatch ? 600 : 400,
                      }}
                    >
                      {fmtDuration(n)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
        );
      })()}

      <InlineUpgradeNudge
        saved={d.saved}
        target={downPayment}
        monthly={savedOnlyMonthly}
        timelineMonths={months}
      />

      {/* Section 2 — Affordability */}
      <Section number="02" title="What it costs to live there.">
        <p style={SubP}>
          A {(mortgageRate * 100).toFixed(2)}% / 30-year fixed mortgage based on your{" "}
          {qualifyingCredit < 670 ? "credit profile" : "credit standing"}.
        </p>

        <div
          style={{
            margin: "24px 0 18px",
            padding: "20px 0",
            borderTop: `1px solid ${C.ink}`,
            borderBottom: `1px solid ${C.ink}`,
          }}
        >
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 56,
              fontWeight: 400,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: C.ink,
              marginBottom: 8,
            }}
          >
            {fmt(totalHousing)}
            <span
              style={{
                fontSize: 16,
                color: C.inkMute,
                fontFamily: "'Inter', sans-serif",
                fontStyle: "italic",
                fontWeight: 400,
                marginLeft: 6,
              }}
            >
              /mo all-in
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: verdictTone,
              }}
            >
              ◆ {verdict}
            </span>
            <span style={{ fontSize: 12, color: C.inkMute }}>
              {Math.round(housingRatio * 100)}% of your income · lenders prefer ≤45%
            </span>
          </div>
        </div>

        <Subhead>The breakdown</Subhead>
        <LineRow label="Principal & interest" val={fmt(mortgage)} />
        <LineRow label="Tax & insurance"     val={fmt(taxIns)} />
        {effectiveDownPct < 20 && <LineRow label="PMI" val={fmt(pmi)} />}
        {hoa > 0     && <LineRow label="HOA dues"            val={fmt(hoa)} />}
        {reserve > 0 && <LineRow label="Maintenance reserve" val={fmt(reserve)} />}
        <LineRow label="Total" val={fmt(totalHousing)} bold />
      </Section>

      {/* Section — Cash to close */}
      {(() => {
        const closing = Math.round((avgPrice * derivedA.closingCostPct) / 100);
        const moving = derivedA.movingCost;
        const totalCash = downPayment + closing + moving;
        const savedPct = Math.max(0, Math.min(100, (d.saved / Math.max(totalCash, 1)) * 100));
        const gap = Math.max(0, totalCash - d.saved);
        return (
          <Section number="03" title="Cash to close">
            <p style={SubP}>
              The deposit isn't the whole bill. Closing costs run about 3% of the
              price, plus a moving budget. Here's the full cash you'll hand over
              on day one — and where you stand against it today.
            </p>

            <Subhead>The full bill</Subhead>
            <LineRow label="Down payment"   val={fmt(downPayment)} />
            <LineRow label="Closing costs"  val={fmt(closing)} />
            <LineRow label="Moving budget"  val={fmt(moving)} />
            <LineRow label="Total cash needed" val={fmt(totalCash)} bold />

            <div style={{ marginTop: 28 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: C.inkMute,
                  }}
                >
                  Where you stand
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: C.ink,
                  }}
                >
                  {Math.round(savedPct)}%
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: C.paperDeep,
                  borderRadius: 4,
                  overflow: "hidden",
                  border: `1px solid ${C.ink}`,
                }}
              >
                <div
                  style={{
                    width: `${savedPct}%`,
                    height: "100%",
                    background:
                      savedPct >= 100 ? C.sage : savedPct >= 50 ? C.gold : C.ember,
                    transition: "width 600ms ease",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 10,
                  fontSize: 12,
                  color: C.inkMute,
                }}
              >
                <span>
                  Saved <strong style={{ color: C.ink }}>{fmt(d.saved)}</strong>
                </span>
                <span>
                  {gap > 0 ? (
                    <>
                      <strong style={{ color: C.ink }}>{fmt(gap)}</strong> to go
                    </>
                  ) : (
                    <strong style={{ color: C.sage }}>You're fully funded</strong>
                  )}
                </span>
              </div>
            </div>
          </Section>
        );
      })()}

      <ReportPaywall monthsSooner={paywallMonthsSooner} />
      

      {/* Footer */}
      <div
        style={{
          marginTop: 40,
          paddingTop: 18,
          borderTop: `1px solid ${C.ink}`,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: C.inkFaint,
        }}
      >
        <span>Keystone</span>
        <span>End of report</span>
      </div>
    </div>
  );
}

// ── Report paywall ───────────────────────────────────────────────────────────
function ReportPaywall({ monthsSooner }: { monthsSooner: number }) {
  const { isPlus, isPro, loading } = useSubscription();
  const gate = useUpgradeGate();
  if (loading) return null;
  if (isPro) return null;

  const hasEdge = monthsSooner >= 2;
  const eyebrow = isPlus ? "Upgrade to Pro" : "Unlock the full plan";
  const headline = isPlus
    ? "Hand off the investing. Reach your goal faster."
    : hasEdge
      ? `Cut ${monthsSooner} months off your timeline.`
      : "Own years sooner. Invest your down payment.";
  const sub = isPlus
    ? "Pro adds adaptive strategy, broker matching, stress-tests, and live rate alerts."
    : "Plus shows you the path. Pro keeps it on track as life changes.";

  return (
    <section
      style={{
        marginTop: 48,
        padding: 28,
        borderRadius: 14,
        background: C.ink,
        color: C.paper,
      }}
    >
      <p
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.ember,
          margin: "0 0 12px",
        }}
      >
        {eyebrow}
      </p>
      <h3
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 32,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
          margin: 0,
        }}
      >
        {headline}
      </h3>
      <p style={{ color: "#d6cfc1", fontSize: 15, lineHeight: 1.5, margin: "12px 0 22px" }}>
        {sub}
      </p>

      {/* Social proof strip */}
      <div
        style={{
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          padding: "10px 0 16px",
          borderTop: "1px solid #3a3a3a",
          borderBottom: "1px solid #3a3a3a",
          margin: "0 0 20px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: C.inkFaint,
          paddingTop: 14,
        }}
      >
        <span>★ 2,400+ plans built</span>
        <span>· 7-day free trial</span>
        <span>· Cancel anytime</span>
      </div>

      {/* Single hero CTA + secondary link */}
      {!isPlus ? (
        <>
          <button
            type="button"
            onClick={() => gate.openUpgrade("plus", "the full plan", "paywall_plus")}
            style={{
              width: "100%",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              padding: "16px 18px",
              borderRadius: 8,
              border: "none",
              background: C.paper,
              color: C.ink,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Start Plus — $5/mo →
          </button>
          <p
            style={{
              textAlign: "center",
              margin: "14px 0 0",
              fontSize: 13,
              color: "#d6cfc1",
            }}
          >
            Want it on autopilot?{" "}
            <button
              type="button"
              onClick={() => gate.openUpgrade("pro", "Pro", "paywall_pro_link")}
              style={{
                background: "transparent",
                border: "none",
                color: C.paper,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                fontSize: 13,
                fontFamily: "inherit",
                padding: 0,
              }}
            >
              See Pro — $11/mo →
            </button>
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => gate.openUpgrade("pro", "Pro", "paywall_pro_card")}
          style={{
            width: "100%",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            padding: "16px 18px",
            borderRadius: 8,
            border: "none",
            background: C.paper,
            color: C.ink,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Go on autopilot — $11/mo →
        </button>
      )}
    </section>
  );
}

// Personalized "X months sooner if you invest the down payment vs save it"
// math, shared by InlineUpgradeNudge, StickyUpgradeBar, ReportPaywall.
function computeMonthsSooner(
  saved: number,
  target: number,
  monthly: number,
  timelineMonths: number,
): number {
  const monthsAt = (rate: number) => {
    if (saved >= target) return 0;
    if (monthly <= 0 && rate <= 0) return timelineMonths;
    const r = rate / 12;
    if (r === 0) return Math.ceil((target - saved) / Math.max(monthly, 1));
    const num = target * r + monthly;
    const den = saved * r + monthly;
    if (den <= 0 || num / den <= 0) return timelineMonths;
    const n = Math.log(num / den) / Math.log(1 + r);
    return isFinite(n) && n > 0 ? Math.ceil(n) : timelineMonths;
  };
  return Math.max(0, monthsAt(0.005) - monthsAt(0.07));
}

// ── Mid-report inline nudge ──────────────────────────────────────────────────
function InlineUpgradeNudge({
  saved,
  target,
  monthly,
  timelineMonths,
}: {
  saved: number;
  target: number;
  monthly: number;
  timelineMonths: number;
}) {
  const { isPlus, loading } = useSubscription();
  const gate = useUpgradeGate();

  // Personalized math: at their current monthly pace, how much sooner could
  // they finish if they invested (~7%) vs. parked in savings (~0.5%)?
  const { yourMonths, plusMonths, monthsSooner, dollarsSaved } = useMemo(() => {
    const monthsAt = (rate: number) => {
      if (saved >= target) return 0;
      if (monthly <= 0 && rate <= 0) return timelineMonths;
      const r = rate / 12;
      if (r === 0) return Math.ceil((target - saved) / Math.max(monthly, 1));
      const num = target * r + monthly;
      const den = saved * r + monthly;
      if (den <= 0 || num / den <= 0) return timelineMonths;
      const n = Math.log(num / den) / Math.log(1 + r);
      return isFinite(n) && n > 0 ? Math.ceil(n) : timelineMonths;
    };
    const mSave = monthsAt(0.005);
    const mInv = monthsAt(0.07);
    const sooner = Math.max(0, mSave - mInv);
    return {
      yourMonths: mSave,
      plusMonths: mInv,
      monthsSooner: sooner,
      dollarsSaved: Math.round(sooner * monthly),
    };
  }, [saved, target, monthly, timelineMonths]);

  if (loading || isPlus) return null;

  const hasEdge = monthsSooner >= 2;
  const headline = hasEdge
    ? `Your plan finishes in ${yourMonths} months. Plus members like you finish in ${plusMonths}.`
    : `Plus shows you the 3 levers to cut months off your plan.`;
  const subline = hasEdge
    ? `That's ${monthsSooner} months sooner — about ${fmt(dollarsSaved)} less out of pocket.`
    : `Personalized to your income, credit, and timeline.`;

  return (
    <div
      style={{
        margin: "32px 0 36px",
        padding: "22px 22px 20px",
        borderRadius: 14,
        background: `linear-gradient(135deg, ${C.cream} 0%, ${C.paperDeep} 100%)`,
        border: `1.5px solid ${C.ink}`,
        boxShadow: `6px 6px 0 0 ${C.ink}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Eyebrow */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.ember,
          marginBottom: 10,
        }}
      >
        ✦ Keystone Plus
      </div>

      {/* Headline */}
      <p
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 24,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          color: C.ink,
          margin: "0 0 6px",
          fontWeight: 500,
        }}
      >
        {headline}
      </p>
      <p style={{ fontSize: 14, color: C.inkSoft, margin: "0 0 18px", lineHeight: 1.45 }}>
        {subline}
      </p>

      {/* Locked tease */}
      <div
        style={{
          background: `${C.paper}cc`,
          border: `1px dashed ${C.inkMute}66`,
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.inkMute,
            marginBottom: 10,
          }}
        >
          The 3 moves that cut your timeline
        </div>
        {[
          { label: "Where to park your down payment", save: `~${Math.max(4, Math.round(monthsSooner * 0.5))} mo` },
          { label: "Credit lift before pre-approval", save: `~${Math.max(3, Math.round(monthsSooner * 0.3))} mo` },
          { label: "Loan program you likely qualify for", save: `~${Math.max(2, Math.round(monthsSooner * 0.2))} mo` },
        ].map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 0",
              borderTop: i === 0 ? "none" : `1px solid ${C.inkMute}22`,
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: C.ember,
                  width: 18,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: C.ink,
                  filter: "blur(5px)",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                aria-hidden
              >
                {row.label}
              </span>
            </div>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: C.inkMute,
                whiteSpace: "nowrap",
              }}
            >
              saves {row.save}
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => gate.openUpgrade("plus", "the faster-path playbook", "inline_nudge")}
        style={{
          width: "100%",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          padding: "15px 18px",
          borderRadius: 8,
          border: "none",
          background: C.ink,
          color: C.paper,
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Unlock for $5/mo →
      </button>
      <p
        style={{
          textAlign: "center",
          fontSize: 11,
          color: C.inkMute,
          margin: "10px 0 0",
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: "0.08em",
        }}
      >
        Cancel anytime · 7-day free trial
      </p>
    </div>
  );
}


// ── Report sub-components ────────────────────────────────────────────────────
const SubP: React.CSSProperties = {
  fontSize: 14,
  color: C.inkMute,
  lineHeight: 1.6,
  margin: "0 0 14px",
  maxWidth: 460,
};

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 44 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: C.ember,
          }}
        >
          §{number}
        </span>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 400,
            fontSize: 28,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            margin: 0,
            color: C.ink,
          }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: C.inkFaint,
        marginBottom: 8,
        marginTop: 8,
      }}
    >
      — {children}
    </div>
  );
}

function Stat({
  label,
  value,
  divider,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 12px",
        borderLeft: divider ? `1px solid ${C.ink}` : "none",
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: C.inkFaint,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 22,
          color: C.ink,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PathCard({
  kicker,
  value,
  unit,
  note,
  highlight,
}: {
  kicker: string;
  value: string;
  unit: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: highlight ? C.cream : C.paper,
        padding: "18px 14px",
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: highlight ? C.ember : C.inkFaint,
          marginBottom: 10,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1,
          color: C.ink,
          marginBottom: 4,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
        <span
          style={{
            fontSize: 11,
            color: C.inkMute,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 400,
            marginLeft: 4,
          }}
        >
          {unit}
        </span>
      </div>
      <div style={{ fontSize: 11, color: C.inkMute, lineHeight: 1.4, marginTop: 8 }}>
        {note}
      </div>
    </div>
  );
}

function LineRow({
  label,
  val,
  bold,
}: {
  label: string;
  val: string;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "10px 0",
        borderBottom: `1px dotted ${C.inkFaint}`,
      }}
    >
      <span
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: bold ? 16 : 14,
          color: C.ink,
          fontWeight: bold ? 600 : 400,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
          color: C.ink,
          fontWeight: bold ? 600 : 400,
        }}
      >
        {val}
      </span>
    </div>
  );
}

function ReadyRow({
  label,
  score,
  note,
}: {
  label: string;
  score: number;
  note: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 15,
            color: C.ink,
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 11, color: C.inkMute }}>{note}</span>
      </div>
      <div style={{ height: 4, background: C.paperDeep, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: C.ink,
            transformOrigin: "left",
            transform: `scaleX(${Math.max(0, Math.min(1, score / 100))})`,
            transition: "transform 0.6s cubic-bezier(.5,0,.2,1)",
          }}
        />
      </div>
    </div>
  );
}

// ── EmailScreen ──────────────────────────────────────────────────────────────
function EmailScreen({
  d,
  set,
  next,
}: {
  d: Data;
  set: <K extends keyof Data>(k: K, v: Data[K]) => void;
  next: () => void;
}) {
  const saveLead = useServerFn(upsertLead);
  const phoneDigits = d.phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 10;
  const emailValid = d.email.includes("@");
  const nameValid = d.firstName.trim().length > 0 && d.lastName.trim().length > 0;
  const canContinue = nameValid && emailValid && phoneValid;
  const handleContinue = () => {
    const email = d.email.trim().toLowerCase();
    if (!canContinue) return;
    saveLead({
      data: {
        email,
        firstName: d.firstName.trim() || undefined,
        lastName: d.lastName.trim() || undefined,
        phone: d.phone.trim() || undefined,
        answers: { ...d, email } as unknown as Record<string, unknown>,
        completed: false,
      },
    }).catch((err) => console.error("[saveLead:email]", err));
    next();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: `1.5px solid ${C.ink}`,
    padding: "12px 0",
    fontSize: 22,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    color: C.ink,
    outline: "none",
    marginBottom: 22,
  };

  return (
    <Question
      kicker="Introductions"
      title="Let's get acquainted."
      sub="Your name and where to send your plan. We don't spam."
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 0 }}>
        <input
          type="text"
          autoComplete="given-name"
          placeholder="First name"
          value={d.firstName}
          onChange={(e) => set("firstName", e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          autoComplete="family-name"
          placeholder="Last name"
          value={d.lastName}
          onChange={(e) => set("lastName", e.target.value)}
          style={inputStyle}
        />
      </div>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@email.com"
        value={d.email}
        onChange={(e) => set("email", e.target.value)}
        style={inputStyle}
      />
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(555) 123-4567"
        value={d.phone}
        onChange={(e) => set("phone", e.target.value)}
        style={{ ...inputStyle, marginBottom: 28 }}
      />
      <Cta onClick={handleContinue} disabled={!canContinue}>
        Continue
      </Cta>

      <div
        style={{
          marginTop: 22,
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: C.inkMute,
        }}
      >
        Already have an account?{" "}
        <Link to="/login" style={{ color: C.ember, textDecoration: "none" }}>
          Sign in
        </Link>
      </div>
    </Question>
  );
}

// ── BirthdayScreen ───────────────────────────────────────────────────────────
function BirthdayScreen({
  d,
  set,
  onNext,
  which,
}: {
  d: Data;
  set: <K extends keyof Data>(k: K, v: Data[K]) => void;
  onNext: () => void;
  which: "user" | "partner";
}) {
  const ageKey = which === "user" ? "age" : "partnerAge";
  const currentAge = which === "user" ? d.age : d.partnerAge;
  const today = new Date();
  const defaultYear = today.getFullYear() - (currentAge || 32);
  const [month, setMonth] = useState<string>("1");
  const [day, setDay] = useState<string>("1");
  const [year, setYear] = useState<string>(String(defaultYear));

  const computedAge = useMemo(() => {
    const m = parseInt(month, 10);
    const dd = parseInt(day, 10);
    const y = parseInt(year, 10);
    if (!m || !dd || !y || y < 1900 || y > today.getFullYear()) return null;
    const dob = new Date(y, m - 1, dd);
    if (isNaN(dob.getTime())) return null;
    let a = today.getFullYear() - y;
    const mDiff = today.getMonth() - (m - 1);
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < dd)) a -= 1;
    return a;
  }, [month, day, year, today]);

  const valid = computedAge !== null && computedAge >= 18 && computedAge <= 100;

  const handleNext = () => {
    if (!valid || computedAge === null) return;
    set(ageKey, computedAge);
    onNext();
  };

  const inputStyle: React.CSSProperties = {
    background: "transparent",
    border: `1.5px solid ${C.ink}`,
    borderRadius: 0,
    padding: "14px 12px",
    fontSize: 16,
    color: C.ink,
    width: "100%",
    textAlign: "center",
    fontFamily: "'JetBrains Mono', monospace",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: C.inkMute,
    marginBottom: 6,
    display: "block",
  };

  return (
    <Question
      kicker={which === "user" ? "About you" : "Partner"}
      title={which === "user" ? "When were you born?" : "When was your partner born?"}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Month</label>
          <input
            style={inputStyle}
            inputMode="numeric"
            placeholder="MM"
            value={month}
            onChange={(e) => setMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
          />
        </div>
        <div>
          <label style={labelStyle}>Day</label>
          <input
            style={inputStyle}
            inputMode="numeric"
            placeholder="DD"
            value={day}
            onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
          />
        </div>
        <div>
          <label style={labelStyle}>Year</label>
          <input
            style={inputStyle}
            inputMode="numeric"
            placeholder="YYYY"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: valid ? C.inkMute : C.ember,
          marginBottom: 24,
          minHeight: 16,
        }}
      >
        {computedAge !== null
          ? valid
            ? `${computedAge} years old`
            : "Must be 18 or older"
          : " "}
      </div>
      <Cta onClick={handleNext} disabled={!valid}>
        Continue
      </Cta>
    </Question>
  );
}

// ── Calculating screen ───────────────────────────────────────────────────────
// Shown for first-time users only between the last risk question and the
// dashboard. ~5s fast-then-slow progress bar with rotating curated facts.
function CalculatingScreen({ onDone }: { onDone: () => void }) {
  const DURATION_MS = 8000;
  const ROTATE_MS = 4000;

  const checkPlans = useServerFn(getMyPlans);
  const [progress, setProgress] = useState(0);
  const [factIdx, setFactIdx] = useState(0);
  const [factKey, setFactKey] = useState(0); // re-trigger fade-in
  const [shouldRun, setShouldRun] = useState<boolean | null>(null);

  // Randomized fact order, fixed per mount.
  const facts = useMemo(() => {
    const arr = [...HOMEOWNERSHIP_FACTS];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  // First-time detection. No session → first-time (lead). Session + 0 plans → first-time.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (!cancelled) setShouldRun(true);
          return;
        }
        const res = await checkPlans();
        const count = Array.isArray(res?.plans) ? res.plans.length : 0;
        if (!cancelled) setShouldRun(count === 0);
      } catch {
        // On any failure, default to showing the screen (safer than flashing past).
        if (!cancelled) setShouldRun(true);
      }
    })();
    return () => { cancelled = true; };
  }, [checkPlans]);

  // Run animation (or skip).
  useEffect(() => {
    if (shouldRun === null) return;
    if (shouldRun === false) {
      onDone();
      return;
    }

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      // easeOutQuart — fast at start, slow at the end.
      const eased = 1 - Math.pow(1 - t, 4);
      setProgress(eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else onDone();
    };
    raf = requestAnimationFrame(tick);

    const rotate = window.setInterval(() => {
      setFactIdx((i) => (i + 1) % facts.length);
      setFactKey((k) => k + 1);
    }, ROTATE_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(rotate);
    };
  }, [shouldRun, facts.length, onDone]);

  if (shouldRun !== true) {
    // Either still checking or skipping — render an empty paper-coloured
    // placeholder so we don't flash white before onDone() fires.
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.paper,
        }}
      />
    );
  }

  const fact = facts[factIdx];
  const pct = Math.round(progress * 100);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.ember,
            marginBottom: 14,
          }}
        >
          — Crunching the numbers
        </div>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 400,
            fontSize: 38,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            color: C.ink,
            margin: "0 0 12px",
          }}
        >
          Calculating your plan.
        </h1>
        <p
          style={{
            color: C.inkSoft,
            fontSize: 15,
            lineHeight: 1.5,
            margin: "0 0 36px",
          }}
        >
          We're pricing your market, modeling your timeline, and stress-testing
          your risk profile. A few seconds.
        </p>

        {/* Rotating fact */}
        <div
          style={{
            minHeight: 110,
            marginBottom: 28,
            padding: "20px 22px",
            border: `1px solid ${C.inkFaint}`,
            borderRadius: 10,
            background: "rgba(255,255,255,0.5)",
          }}
        >
          <div
            key={factKey}
            className="animate-fade-in"
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: C.ember,
              }}
            >
              Did you know
            </div>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 22,
                lineHeight: 1.25,
                color: C.ink,
              }}
            >
              {fact.headline}
            </div>
            <div style={{ fontSize: 13, color: C.inkMute, lineHeight: 1.4 }}>
              {fact.sub}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 8,
              background: "rgba(26,26,26,0.08)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: C.ember,
                borderRadius: 999,
                transition: "width 80ms linear",
              }}
            />
          </div>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.1em",
              color: C.inkMute,
              minWidth: 36,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
}
