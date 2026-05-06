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
  styleAdjustments,
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
  "partner",
  "age",
  "employment",
  "income",
  "expenses",
  "debt",
  "savings",
  "credit",
  "partnerEmployment",
  "partnerIncome",
  "partnerExpenses",
  "partnerDebt",
  "partnerCredit",
  "introPartnerSummary",
  "factDemo",
  "introHome",
  "zip",
  "homeStyle",
  "timeline",
  "factDown",
  "introRisk",
  "risk0",
  "risk1",
  "risk2",
  "risk3",
  "factCompound",
  "dashboard",
] as const;
type Screen = (typeof FLOW)[number];

const PROGRESS_SCREENS: Screen[] = [
  "email",
  "partner",
  "age", "employment", "income", "expenses", "debt", "savings", "credit",
  "partnerEmployment", "partnerIncome", "partnerExpenses", "partnerDebt", "partnerCredit",
  "zip", "homeStyle", "timeline",
  "risk0", "risk1", "risk2", "risk3",
];

type Data = {
  email: string;
  age: number;
  employment: string | null;
  income: number;
  expenses: number;
  debt: number;
  credit: number | null;
  saved: number;
  hasPartner: boolean | null;
  partnerEmployment: string | null;
  partnerIncome: number;
  partnerExpenses: number;
  partnerDebt: number;
  partnerCredit: number | null;
  zip: string;
  zipData: { city: string; avg: number } | null;
  homeStyle: string | null;
  timelineYears: number;
  timelineBucket: string | null;
  riskAnswers: Record<number, number>;
};

const INITIAL: Data = {
  email: "",
  age: 32,
  employment: null,
  income: 75000,
  expenses: 3000,
  debt: 400,
  credit: null,
  saved: 15000,
  hasPartner: null,
  partnerEmployment: null,
  partnerIncome: 0,
  partnerExpenses: 0,
  partnerDebt: 0,
  partnerCredit: null,
  zip: "",
  zipData: null,
  homeStyle: null,
  timelineYears: 3,
  timelineBucket: null,
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

  const next = () => {
    let nextIdx = screenIdx + 1;
    const partnerOnly = ["partnerEmployment", "partnerIncome", "partnerExpenses", "partnerDebt", "partnerCredit", "introPartnerSummary"];
    if (d.hasPartner === false) {
      while (nextIdx < FLOW.length && partnerOnly.includes(FLOW[nextIdx])) {
        nextIdx += 1;
      }
    }
    setScreenIdx(Math.min(FLOW.length - 1, nextIdx));
  };
  const back = () => {
    let prevIdx = screenIdx - 1;
    const partnerOnly = ["partnerEmployment", "partnerIncome", "partnerExpenses", "partnerDebt", "partnerCredit", "introPartnerSummary"];
    if (d.hasPartner === false) {
      while (prevIdx > 0 && partnerOnly.includes(FLOW[prevIdx])) {
        prevIdx -= 1;
      }
    }
    setScreenIdx(Math.max(0, prevIdx));
  };

  return (
    <Shell>
      {screen !== "welcome" && screen !== "dashboard" && (
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
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.inkFaint,
          }}
        >
          {screen.startsWith("risk") ? "Risk" : screen.startsWith("partner") ? "Partner" : screen.startsWith("fact") ? "Reading" : screen.startsWith("intro") ? "Chapter" : "Step"}
        </span>
      </div>
      {progress !== null && (
        <div
          style={{
            height: 1,
            background: "rgba(26,26,26,0.12)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: C.ink,
              transformOrigin: "left",
              transform: `scaleX(${progress})`,
              transition: "transform 0.45s cubic-bezier(.5,0,.2,1)",
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
    return (
      <Question kicker="About you" title="How old are you?">
        <Slider
          value={d.age}
          min={18}
          max={75}
          step={1}
          format={(v) => `${v}`}
          onChange={(v) => set("age", v)}
          unit="years old"
        />
        <Cta onClick={next}>Continue</Cta>
      </Question>
    );

  if (screen === "employment")
    return (
      <Question
        kicker="Work"
        title="How do you earn your income?"
        sub="Lenders typically want 2 years in the same line of work. Self-employed buyers usually need 2 years of tax returns."
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
        sub="Before taxes. Don't include your partner — we'll ask separately."
      >
        <Slider
          value={d.income}
          min={20000}
          max={400000}
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
          max={300000}
          step={500}
          format={(v) => fmt(v)}
          onChange={(v) => set("saved", v)}
        />
        <Cta onClick={next}>Continue</Cta>
      </Question>
    );

  if (screen === "partner")
    return (
      <Question
        kicker="Chapter I — First, the household"
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

  if (screen === "timeline")
    return (
      <Question
        kicker="When"
        title="When do you want to buy?"
        sub="We'll tailor the plan to fit your window."
      >
        <Choices
          options={TIMELINE_BUCKETS.map((b) => ({
            val: b.id,
            label: b.label,
            desc: b.desc,
          }))}
          value={d.timelineBucket}
          onSelect={(v) => {
            const b = TIMELINE_BUCKETS.find((x) => x.id === v);
            set("timelineBucket", v as string);
            if (b) set("timelineYears", b.years);
          }}
        />
        <Cta onClick={next} disabled={!d.timelineBucket}>
          Continue
        </Cta>
      </Question>
    );


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
          marginBottom: 80,
        }}
      >
        <Wordmark />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.inkFaint,
          }}
        >
          Vol. 01
        </span>
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
        — A homebuying plan, in print
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
        The
        <br />
        <em style={{ fontStyle: "italic", fontWeight: 600 }}>Foundation</em>
        <br />
        for your first home.
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
        We simplify homeownership by automating your savings and optimizing your
        portfolio specifically for a down payment. It's more than just an
        investment account; it's the path to your future address.
      </p>

      <Cta onClick={onStart} large>
        Begin the plan
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
        <span>~ 5 minutes</span>
        <span>No account</span>
        <span>Free</span>
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
                  color: active ? "rgba(251,247,240,0.6)" : C.inkFaint,
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
        {chapter}
      </div>
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
      kicker="Where"
      title="Where are you buying?"
      sub="We use your area to set the local price benchmark."
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
        </>
      )}

      {d.zipData !== null && (
        <ZipCallout city={d.zipData!.city} avg={d.zipData!.avg} />
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
  // Default down payment derived from savings as % of price; floored to min, capped at 20.
  const savingsRatio = avgPrice > 0 ? (d.saved / avgPrice) * 100 : 0;
  const candidate = savingsRatio >= 20 ? 20 : savingsRatio >= 10 ? 10 : savingsRatio >= 5 ? 5 : 3.5;
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

  const mortgageRate = rateFromCredit(qualifyingCredit);
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
    housingRatio <= 0.28 ? "Affordable" : housingRatio <= 0.36 ? "A stretch" : "Difficult";
  const verdictTone =
    housingRatio <= 0.28 ? C.sage : housingRatio <= 0.36 ? C.gold : C.ember;

  const eFundMin = combinedExpenses * 3;
  const eFundOk = d.saved >= eFundMin;

  const creditScoreNorm = Math.max(
    0,
    Math.min(100, ((qualifyingCredit - 580) / (820 - 580)) * 100),
  );
  const dti = (combinedDebt + totalHousing) / monthlyIncome;
  const dtiScore = Math.max(0, Math.min(100, (1 - (dti - 0.28) / 0.2) * 100));
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
      <Section number="01" title="Save, or invest?">
        <p style={SubP}>
          To put down{" "}
          <em style={{ fontStyle: "italic" }}>{fmt(downPayment)}</em> in{" "}
          {d.timelineYears} years, here's what each path costs you per month.
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
            value={fmt(savedOnlyMonthly)}
            unit="/ month"
            note="Cash in a regular account. No growth assumed."
          />
          <PathCard
            kicker={`Path B · ${risk.label}`}
            value={fmt(investedMonthly)}
            unit="/ month"
            note={`Invested at ~${(risk.rate * 100).toFixed(0)}% annually.`}
            highlight
          />
        </div>

        {savedOnlyMonthly > investedMonthly && (
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
            Investing saves you{" "}
            <strong style={{ color: C.ember, fontStyle: "normal" }}>
              {fmt(savedOnlyMonthly - investedMonthly)}/mo
            </strong>{" "}
            — and protects against inflation while you wait.
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
                const m = calcRequiredMonthly(d.saved, downPayment, months, s.rate);
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
                      {fmt(m)}/mo
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Down payment buckets */}
      <Section number="02" title="Your down payment options.">
        <p style={SubP}>
          Based on {fmt(d.saved)} saved against {fmtCompact(avgPrice)}, we modeled your plan at{" "}
          <em style={{ fontStyle: "italic" }}>{effectiveDownPct}% down</em>. Here's what each path
          would actually mean for you.
        </p>
        <div style={{ marginTop: 14 }}>
          {DOWN_BUCKETS.map((b) => {
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
              {Math.round(housingRatio * 100)}% of your income · lenders prefer ≤28%
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
