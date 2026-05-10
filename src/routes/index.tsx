import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/")({
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
  "name",
  "partner",
  "age",
  "employment",
  "income",
  "expenses",
  "debt",
  "savings",
  "credit",
  "partnerAge",
  "partnerEmployment",
  "partnerIncome",
  "partnerExpenses",
  "partnerDebt",
  "partnerCredit",
  "factDemo",
  "zip",
  "homeStyle",
  "homeFeatures",
  "downGoal",
  "timeline",
  "introRisk",
  "risk0",
  "risk1",
  "risk2",
  "risk3",
  "handoff",
  "dashboard",
] as const;
type Screen = (typeof FLOW)[number];

const PROGRESS_SCREENS: Screen[] = [
  "email",
  "introFinances",
  "name",
  "partner",
  "age", "employment", "income", "expenses", "debt", "savings", "credit",
  "partnerAge", "partnerEmployment", "partnerIncome", "partnerExpenses", "partnerDebt", "partnerCredit",
  "factDemo",
  "zip", "homeStyle", "homeFeatures", "downGoal", "timeline",
  "introRisk",
  "risk0", "risk1", "risk2", "risk3",
];

type Data = {
  email: string;
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
  partnerAge: number;
  partnerEmployment: string | null;
  partnerIncome: number;
  partnerExpenses: number;
  partnerDebt: number;
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
};

const INITIAL: Data = {
  email: "",
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
  partnerAge: 32,
  partnerEmployment: null,
  partnerIncome: 0,
  partnerExpenses: 0,
  partnerDebt: 0,
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

// ── Root component ───────────────────────────────────────────────────────────
function KeystoneApp() {
  const [d, setD] = useState<Data>(INITIAL);
  const [screenIdx, setScreenIdx] = useState(0);
  const screen: Screen = FLOW[screenIdx];

  useEffect(() => {
    if (typeof document !== "undefined") {
      const id = "keystone-fonts";
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";
        document.head.appendChild(link);
      }
    }
  }, []);

  const set = <K extends keyof Data>(k: K, v: Data[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  const shouldSkip = (idx: number) => {
    const s = FLOW[idx];
    const partnerOnly = ["partnerAge", "partnerEmployment", "partnerIncome", "partnerExpenses", "partnerDebt", "partnerCredit", "introPartnerSummary"];
    if (d.hasPartner === false && partnerOnly.includes(s)) return true;
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

  return (
    <Shell>
      {screen !== "welcome" && screen !== "dashboard" && screen !== "handoff" && (
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

  if (screen === "email")
    return (
      <Question
        kicker="Your turn"
        title="Where should we send your plan?"
        sub="Just for the report. We don't spam."
      >
        <input
          type="email"
          inputMode="email"
          placeholder="you@email.com"
          value={d.email}
          onChange={(e) => set("email", e.target.value)}
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
            marginBottom: 28,
          }}
        />
        <Cta onClick={next} disabled={!d.email.includes("@")}>
          Continue
        </Cta>
      </Question>
    );

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

  if (screen === "income")
    return (
      <Question
        kicker="Income"
        title="What's your gross annual income?"
        sub={d.hasPartner ? "Before taxes. Don't include your partner — we'll ask separately." : "Before taxes."}
      >
        <Slider
          value={d.income}
          min={20000}
          max={200000}
          step={1000}
          format={(v) => fmt(v)}
          onChange={(v) => set("income", v)}
        />
        <Cta onClick={next}>Continue</Cta>
      </Question>
    );

  if (screen === "expenses")
    return (
      <Question
        kicker="Spending"
        title="Monthly expenses?"
        sub="Rent, groceries, transport, subscriptions — the must-pays."
      >
        <Slider
          value={d.expenses}
          min={500}
          max={15000}
          step={50}
          format={(v) => fmt(v)}
          onChange={(v) => set("expenses", v)}
          unit="per month"
        />
        <Cta onClick={next}>Continue</Cta>
      </Question>
    );

  if (screen === "debt")
    return (
      <Question
        kicker="Debt"
        title="Monthly debt payments?"
        sub="Student loans, car payments, credit cards minimums."
      >
        <Slider
          value={d.debt}
          min={0}
          max={5000}
          step={25}
          format={(v) => fmt(v)}
          onChange={(v) => set("debt", v)}
          unit="per month"
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

  if (screen === "savings")
    return (
      <Question
        kicker="Savings"
        title="What have you saved already?"
        sub="Cash, savings, investments earmarked for the home."
      >
        <Slider
          value={d.saved}
          min={0}
          max={200000}
          step={500}
          format={(v) => fmt(v)}
          onChange={(v) => set("saved", v)}
        />
        <Cta onClick={next}>Continue</Cta>
      </Question>
    );

  if (screen === "name")
    return (
      <Question
        kicker="Introductions"
        title="What's your name?"
        sub="So we can make this feel a little more personal."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28 }}>
          <input
            type="text"
            placeholder="First name"
            value={d.firstName}
            onChange={(e) => set("firstName", e.target.value)}
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
            value={d.lastName}
            onChange={(e) => set("lastName", e.target.value)}
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
        <Cta onClick={next} disabled={!d.firstName.trim() || !d.lastName.trim()}>
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

  if (screen === "partnerIncome")
    return (
      <Question kicker="Partner" title="Partner's gross annual income?">
        <Slider
          value={d.partnerIncome}
          min={0}
          max={400000}
          step={1000}
          format={(v) => fmt(v)}
          onChange={(v) => set("partnerIncome", v)}
        />
        <Cta onClick={next}>Continue</Cta>
      </Question>
    );

  if (screen === "partnerExpenses")
    return (
      <Question kicker="Partner" title="Partner's monthly expenses?">
        <Slider
          value={d.partnerExpenses}
          min={0}
          max={15000}
          step={50}
          format={(v) => fmt(v)}
          onChange={(v) => set("partnerExpenses", v)}
        />
        <Cta onClick={next}>Continue</Cta>
      </Question>
    );

  if (screen === "partnerDebt")
    return (
      <Question kicker="Partner" title="Partner's monthly debt?">
        <Slider
          value={d.partnerDebt}
          min={0}
          max={5000}
          step={25}
          format={(v) => fmt(v)}
          onChange={(v) => set("partnerDebt", v)}
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

  if (screen === "timeline") {
    const zipData = d.zipData ?? { city: "your area", avg: 400000 };
    const styleIds = d.homeStyle ? [d.homeStyle] : [];
    const adj = styleAdjustments(styleIds);
    const avgPrice = Math.round(zipData.avg * adj.priceMult);
    const candidate = d.downGoalPct ?? 10;
    const effectiveDownPct = Math.max(candidate, adj.minDown);
    const target = Math.round((avgPrice * effectiveDownPct) / 100);

    const takeHomeMonthly = ((d.income ?? 0) * 0.78) / 12;
    const monthlyExpenses = (d.expenses ?? 0) + (d.debt ?? 0);
    const headroom = Math.max(0, takeHomeMonthly - monthlyExpenses);
    // Cap at 50% of take-home OR available headroom, whichever is lower. $100 increments.
    const halfTakeHome = takeHomeMonthly * 0.5;
    const rawMax = Math.min(halfTakeHome, headroom);
    const maxSave = Math.max(100, Math.floor(rawMax / 100) * 100);

    const remaining = Math.max(0, target - d.saved);
    const stored = d.timelineBucket?.startsWith("$")
      ? parseInt(d.timelineBucket.slice(1), 10) || 100
      : 100;
    const monthlySave = Math.min(maxSave, Math.max(100, stored));
    const yearsToBuy = monthlySave > 0 ? remaining / monthlySave / 12 : 0;
    const yearsLabel = yearsToBuy >= 1
      ? `${yearsToBuy.toFixed(1)} ${yearsToBuy.toFixed(1) === "1.0" ? "year" : "years"}`
      : `${Math.max(1, Math.round(yearsToBuy * 12))} months`;

    return (
      <Question
        kicker="Timeline"
        title="How long would it take using only a savings account?"
        sub="Choose the monthly amount you feel comfortable setting aside toward your down payment. We'll show you how long it would take. But don't worry — we can get you there faster."
      >
        <Slider
          value={monthlySave}
          min={100}
          max={maxSave}
          step={100}
          format={(v) => fmt(v)}
          unit={`per month toward ${fmt(target)}`}
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
    const targetPrice = Math.round(zd.avg * adj.priceMult);
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

    // Build the option list — standard buckets, plus a custom DTI-required bucket if needed.
    type Opt = { pct: number; label: string; tag: string; desc: string };
    const baseOpts: Opt[] = DOWN_BUCKETS.map((b) => ({
      pct: b.pct,
      label: `${b.label} down`,
      tag: b.tag,
      desc: b.desc,
    }));
    if (dtiRequiredPct !== null && !baseOpts.some((o) => o.pct === dtiRequiredPct)) {
      baseOpts.push({
        pct: dtiRequiredPct,
        label: `${dtiRequiredPct}% down`,
        tag: "DTI-required",
        desc: "Needed to qualify given current debts and income",
      });
    }
    // Only show options the user would actually qualify for given DTI cap.
    const qualifyingOpts = baseOpts.filter(
      (o) => calcMortgage(targetPrice, o.pct, rateFor(o.pct)) <= maxHousing,
    );
    const visibleOpts = qualifyingOpts.length > 0 ? qualifyingOpts : baseOpts;
    visibleOpts.sort((a, b) => a.pct - b.pct);

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
        <Choices
          options={visibleOpts.map((b) => {
            const monthly = Math.round(calcMortgage(targetPrice, b.pct, mRate));
            const isRec = b.pct === recommendedPct;
            const recLabel =
              dtiRequiredPct !== null && recommendedPct > 20
                ? "★ Required"
                : "★ Recommended";
            return {
              val: String(b.pct),
              label: `${b.label} · ${b.tag}`,
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

    const zdLive = d.zipData ?? { city: "your area", avg: 400000 };
    const baseAdjLive = styleAdjustments(d.homeStyle ? [d.homeStyle] : []);
    let multLive = baseAdjLive.priceMult;
    multLive += Math.max(0, d.beds - 3) * 0.05;
    multLive += Math.max(0, d.baths - 2) * 0.03;
    if (d.outdoorSpace === "patio") multLive += 0.02;
    if (d.outdoorSpace === "yard") multLive += 0.05;
    if (d.parking === "driveway") multLive += 0.02;
    if (d.parking === "garage") multLive += 0.05;
    const weightLive = (v: "nice" | "must") => (v === "must" ? 0.025 : 0.01);
    Object.values(d.lifestyle).forEach((v) => (multLive += weightLive(v)));
    Object.values(d.neighborhood).forEach((v) => (multLive += weightLive(v)));
    const livePriceTop = Math.round(zdLive.avg * multLive);

    return (
      <Question
        kicker="Features"
        title="Picture the place."
        sub="Choose the bedrooms, baths, style, and features you'd like."
      >
        <div
          style={{
            marginTop: 4,
            marginBottom: 8,
            padding: "16px 16px 14px",
            border: `1px solid ${C.ink}`,
            background: C.cream,
            position: "sticky",
            top: 8,
            zIndex: 5,
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
            Estimated price · {zdLive.city}
          </div>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 38,
              lineHeight: 1.05,
              color: C.ink,
              marginTop: 6,
              fontVariantNumeric: "tabular-nums",
              transition: "all .25s ease",
            }}
          >
            {fmt(livePriceTop)}
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
            Updates live as you adjust features below.
          </div>
        </div>
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

  if (screen === "handoff") return <Handoff email={d.email} onNext={next} />;

  if (screen === "dashboard") return <Report d={d} />;

  return null;
}

// ── Welcome ──────────────────────────────────────────────────────────────────
function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ paddingTop: 36 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 14,
          borderBottom: `1px solid ${C.rule}`,
          marginBottom: 80,
        }}
      >
        <Wordmark />
      </div>

      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.ember,
          marginBottom: 18,
        }}
      >
        — A homebuying plan
      </div>

      <h1
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 400,
          fontSize: 56,
          lineHeight: 0.98,
          letterSpacing: "-0.025em",
          margin: "0 0 22px",
          color: C.ink,
        }}
      >
        An investment account for your future home.
      </h1>

      <p
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 19,
          lineHeight: 1.45,
          color: C.inkSoft,
          margin: "0 0 32px",
          maxWidth: 460,
        }}
      >
        Automatically invest toward your down payment with a plan built to get
        you there faster.
      </p>

      <Cta onClick={onStart} large>
        Build My Plan →
      </Cta>

      <div
        style={{
          marginTop: 32,
          paddingTop: 16,
          borderTop: `1px solid ${C.rule}`,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: C.inkFaint,
        }}
      >
        <span>~ 2 minutes</span>
        <span>No account required</span>
      </div>
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
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  unit?: string;
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
      <div style={{ position: "relative", height: 30 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 14,
            height: 2,
            background: "rgba(26,26,26,0.18)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 14,
            height: 2,
            width: `${pct}%`,
            background: C.ink,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${pct}%`,
            top: 6,
            transform: "translateX(-50%)",
            width: 18,
            height: 18,
            background: C.ember,
            border: `2px solid ${C.ink}`,
            pointerEvents: "none",
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
            opacity: 0,
            cursor: "pointer",
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
        <span>{format(max)}</span>
      </div>
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

function Handoff({ email, onNext }: { email: string; onNext: () => void }) {
  return (
    <div style={{ paddingTop: 60, textAlign: "center" }}>
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
        — That's everything
      </div>
      <div style={{ height: 1, background: C.ink, marginBottom: 32 }} />
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 400,
          fontSize: 38,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          margin: "0 0 22px",
          color: C.ink,
        }}
      >
        Your timeline is ready
      </h2>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: C.inkSoft,
          margin: "0 auto 16px",
          maxWidth: 420,
        }}
      >
        We mapped out a plan to help you reach your down payment—faster.
      </p>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: C.inkSoft,
          margin: "0 auto 16px",
          maxWidth: 420,
        }}
      >
        {email ? (
          <>
            Sent to{" "}
            <span style={{ color: C.ink, fontWeight: 600 }}>{email}</span>{" "}
            so you can revisit anytime
          </>
        ) : (
          "Sent to your email so you can revisit anytime"
        )}
      </p>
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: C.inkMute,
          margin: "0 auto 40px",
          maxWidth: 420,
          fontStyle: "italic",
          fontFamily: "'Cormorant Garamond', Georgia, serif",
        }}
      >
        Most people take years. Yours might look different.
      </p>
      <Cta onClick={onNext}>Show Me My Timeline →</Cta>
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
  const [status, setStatus] = useState<"idle" | "asking" | "denied" | "manual" | "located">("idle");
  const [error, setError] = useState<string | null>(null);

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("manual");
      return;
    }
    setStatus("asking");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
          );
          const j = await res.json();
          const zip: string | undefined = j?.address?.postcode;
          if (zip && /^\d{5}/.test(zip)) {
            const z = zip.slice(0, 5);
            set("zip", z);
            set("zipData", getPriceByZip(z));
            setStatus("located");
          } else {
            setStatus("manual");
            setError("Couldn't pin a ZIP from that location.");
          }
        } catch {
          setStatus("manual");
          setError("Lookup failed. Enter a ZIP instead.");
        }
      },
      () => {
        setStatus("manual");
      },
      { timeout: 8000 },
    );
  };

  return (
    <Question
      kicker="The home"
      title="Where you're buying, and what you're buying."
      sub="Your location sets the local price benchmark. Share your location or enter a ZIP — next we'll cover the home style and timeline."
    >
      {status === "idle" && (
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={requestLocation}
            style={{
              background: "transparent",
              color: C.ink,
              border: `1.5px solid ${C.ink}`,
              padding: "16px 18px",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: "pointer",
              width: "100%",
              marginBottom: 12,
            }}
          >
            ◎ Use my location
          </button>
          <button
            onClick={() => setStatus("manual")}
            style={{
              background: "transparent",
              color: C.inkMute,
              border: "none",
              padding: "8px 0",
              fontSize: 12,
              cursor: "pointer",
              width: "100%",
              textDecoration: "underline",
              textUnderlineOffset: 4,
            }}
          >
            Enter a ZIP instead
          </button>
        </div>
      )}

      {status === "asking" && (
        <div style={{ marginBottom: 28, color: C.inkMute, fontSize: 13 }}>
          Asking your browser for permission…
        </div>
      )}

      {(status === "manual" || status === "located") && (
        <>
          {error && (
            <div style={{ fontSize: 12, color: C.ember, marginBottom: 10 }}>{error}</div>
          )}
          <input
            type="text"
            inputMode="numeric"
            placeholder="00000"
            maxLength={5}
            value={d.zip}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 5);
              set("zip", v);
              if (v.length === 5) set("zipData", getPriceByZip(v));
              else set("zipData", null);
            }}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: `1.5px solid ${C.ink}`,
              padding: "12px 0",
              fontSize: 32,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.2em",
              color: C.ink,
              outline: "none",
              marginBottom: 18,
            }}
          />
          {d.zipData && (
            <div style={{ fontSize: 14, color: C.inkSoft, marginBottom: 18, fontStyle: "italic" }}>
              {d.zipData.city}
            </div>
          )}
        </>
      )}


      <Cta onClick={next} disabled={d.zip.length !== 5}>
        Continue
      </Cta>
    </Question>
  );
}


function Report({ d }: { d: Data }) {
  const zipData = d.zipData ?? { city: "your area", avg: 400000 };
  const styleIds = d.homeStyle ? [d.homeStyle] : [];
  const styleAdj = useMemo(() => styleAdjustments(styleIds), [d.homeStyle]);
  const avgPrice = Math.round(zipData.avg * styleAdj.priceMult);
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

  const empAdjReady = combinedEmploymentAdjustment(
    d.employment,
    hasPartner ? d.partnerEmployment : null,
  );
  const mortgageRate =
    rateFromCredit(qualifyingCredit) +
    empAdjReady.rateAdd +
    rateAddFromDownPct(effectiveDownPct);
  const mortgage = calcMortgage(avgPrice, effectiveDownPct, mortgageRate);
  const taxIns = (avgPrice * 0.018) / 12;
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

      {/* Down payment buckets — mirror the options the user was offered earlier in the flow */}
      {(() => {
        const DTI_CAP_R = empAdjReady.dtiCap;
        const grossMonthlyR = monthlyIncome * empAdjReady.incomeFactor;
        const maxHousingR = Math.max(0, grossMonthlyR * DTI_CAP_R - combinedDebt);
        const baseRateR = rateFromCredit(qualifyingCredit) + empAdjReady.rateAdd;
        const rateForR = (pct: number) => baseRateR + rateAddFromDownPct(pct);

        type Opt = { pct: number; label: string; tag: string; desc: string };
        const baseOptsR: Opt[] = DOWN_BUCKETS.map((b) => ({
          pct: b.pct,
          label: b.label,
          tag: b.tag,
          desc: b.desc,
        }));

        const anyQualifies = baseOptsR.some(
          (o) => calcMortgage(avgPrice, o.pct, rateForR(o.pct)) <= maxHousingR,
        );
        if (!anyQualifies && maxHousingR > 0) {
          let lo = 20, hi = 95;
          for (let i = 0; i < 40; i++) {
            const mid = (lo + hi) / 2;
            const m = calcMortgage(avgPrice, mid, rateForR(mid));
            if (m > maxHousingR) lo = mid;
            else hi = mid;
          }
          const dtiRequiredPctR = Math.ceil(hi);
          if (!baseOptsR.some((o) => o.pct === dtiRequiredPctR)) {
            baseOptsR.push({
              pct: dtiRequiredPctR,
              label: `${dtiRequiredPctR}%`,
              tag: "DTI-required",
              desc: "Needed to qualify given current debts and income",
            });
          }
        }
        const qualifyingOptsR = baseOptsR.filter(
          (o) => calcMortgage(avgPrice, o.pct, rateForR(o.pct)) <= maxHousingR,
        );
        const visibleOptsR = (qualifyingOptsR.length > 0 ? qualifyingOptsR : baseOptsR).sort(
          (a, b) => a.pct - b.pct,
        );

        return (
      <Section number="02" title="Your down payment options.">
        <p style={SubP}>
          Based on {fmt(d.saved)} saved against {fmtCompact(avgPrice)}, we modeled your plan at{" "}
          <em style={{ fontStyle: "italic" }}>{effectiveDownPct}% down</em>.{" "}
          {visibleOptsR.length === 1
            ? "Given your numbers, this is the path that qualifies."
            : "Here's what each path would actually mean for you."}
        </p>
        <div style={{ marginTop: 14 }}>
          {visibleOptsR.map((b) => {
            const dp = Math.round((avgPrice * b.pct) / 100);
            const m = calcMortgage(avgPrice, b.pct, mortgageRate);
            const pmiB = b.pct < 20 ? (avgPrice * (1 - b.pct / 100) * 0.005) / 12 : 0;
            const allIn = m + taxIns + pmiB + hoa + reserve;
            const isMatch = b.pct === effectiveDownPct;
            return (
              <div
                key={b.pct}
                style={{
                  borderTop: `1px solid ${C.ink}`,
                  background: isMatch ? C.cream : "transparent",
                  padding: "14px 12px",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 14,
                  alignItems: "baseline",
                }}
              >
                <div
                  style={{
                    fontFamily: "\'Fraunces\', serif",
                    fontSize: 22,
                    fontWeight: 600,
                    color: isMatch ? C.ember : C.ink,
                    minWidth: 56,
                  }}
                >
                  {b.label}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: C.ink, marginBottom: 2 }}>
                    {b.tag} · {b.desc}
                  </div>
                  <div
                    style={{
                      fontFamily: "\'JetBrains Mono\', monospace",
                      fontSize: 11,
                      color: C.inkMute,
                    }}
                  >
                    {fmt(dp)} down · {fmt(allIn)}/mo all-in{b.pct < 20 ? " · PMI" : " · no PMI"}
                  </div>
                </div>
                {isMatch && (
                  <span
                    style={{
                      fontFamily: "\'JetBrains Mono\', monospace",
                      fontSize: 9,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: C.ember,
                    }}
                  >
                    ◆ Yours
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Section>
        );
      })()}

      {/* Section 3 — Affordability */}
      <Section number="03" title="What it costs to live there.">
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

      {/* Section 3 — Readiness */}
      <Section number="04" title={`${readinessLabel}.`}>
        <p style={SubP}>
          A composite of your credit, debt-to-income, savings progress, and
          timeline.
        </p>

        <div style={{ margin: "28px 0 22px" }}>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 96,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              color: C.ink,
              fontWeight: 400,
            }}
          >
            {readiness}
            <span style={{ fontSize: 32, color: C.inkFaint }}> / 100</span>
          </div>
        </div>

        <ReadyRow label="Credit"   score={creditScoreNorm} note={`${qualifyingCredit} score`} />
        <ReadyRow label="DTI"      score={dtiScore}        note={`${Math.round(dti * 100)}% of income`} />
        <ReadyRow label="Savings"  score={savingsScore}    note={`${fmt(d.saved)} of ${fmt(downPayment)}`} />
        <ReadyRow label="Timeline" score={timelineScore}   note={`${d.timelineYears} year${d.timelineYears > 1 ? "s" : ""}`} />

        {!eFundOk && (
          <div
            style={{
              marginTop: 24,
              padding: 16,
              border: `1.5px solid ${C.gold}`,
              background: "rgba(168,133,58,0.08)",
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: C.gold,
                marginBottom: 6,
              }}
            >
              ◆ Build a buffer first
            </div>
            <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.55 }}>
              Lenders want to see ~3 months of expenses ({fmt(eFundMin)}) in
              reserve before you close. You're at {fmt(d.saved)}.
            </div>
          </div>
        )}
      </Section>

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
