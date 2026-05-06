import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CREDIT_BUCKETS,
  FACTS,
  HOME_STYLES,
  RISK_QS,
  STRATEGIES,
  calcMortgage,
  calcRequiredMonthly,
  deriveRisk,
  fmt,
  getPriceByZip,
  styleAdjustments,
} from "@/lib/heimili";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Heimili — Your path to a first home" },
      {
        name: "description",
        content:
          "Personalized investment, affordability, and readiness plan for first-time home buyers.",
      },
      { property: "og:title", content: "Heimili — Your path to a first home" },
      {
        property: "og:description",
        content:
          "Tell Heimili about your finances and get a custom plan to reach your down payment.",
      },
    ],
  }),
  component: HeimiliApp,
});

// ── Flow ─────────────────────────────────────────────────────────────────────

const FLOW = [
  "welcome",
  "email",
  "age",
  "fact1",
  "income",
  "expenses",
  "debt",
  "credit",
  "savings",
  "fact2",
  "partner",
  "partnerIncome",
  "partnerExpenses",
  "partnerDebt",
  "partnerCredit",
  "fact3",
  "zip",
  "homeStyle",
  "timeline",
  "downPct",
  "fact4",
  "risk0",
  "risk1",
  "risk2",
  "risk3",
  "dashboard",
] as const;
type Screen = (typeof FLOW)[number];

const NON_INPUT: Screen[] = ["welcome", "fact1", "fact2", "fact3", "fact4", "dashboard"];
const INPUT_STEPS = FLOW.filter((s) => !NON_INPUT.includes(s));

type Data = {
  email: string;
  age: number;
  income: number;
  expenses: number;
  debt: number;
  credit: number | null;
  saved: number;
  hasPartner: boolean | null;
  partnerIncome: number;
  partnerExpenses: number;
  partnerDebt: number;
  partnerCredit: number | null;
  zip: string;
  zipData: { city: string; avg: number } | null;
  homeStyles: string[];
  timelineYears: number;
  downPct: number;
  riskAnswers: Record<number, number>;
};

const INITIAL: Data = {
  email: "",
  age: 32,
  income: 75000,
  expenses: 3000,
  debt: 400,
  credit: null,
  saved: 8000,
  hasPartner: null,
  partnerIncome: 60000,
  partnerExpenses: 2000,
  partnerDebt: 300,
  partnerCredit: null,
  zip: "",
  zipData: null,
  homeStyles: [],
  timelineYears: 3,
  downPct: 10,
  riskAnswers: {},
};

// ── App ──────────────────────────────────────────────────────────────────────

function HeimiliApp() {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Data>(INITIAL);
  const screen = FLOW[step];

  const set = <K extends keyof Data>(k: K, v: Data[K]) => setD((x) => ({ ...x, [k]: v }));

  const go = () => {
    let next = step + 1;
    // skip partner subscreens if no partner
    while (
      next < FLOW.length &&
      d.hasPartner === false &&
      ["partnerIncome", "partnerExpenses", "partnerDebt", "partnerCredit"].includes(FLOW[next])
    ) {
      next++;
    }
    setStep(Math.min(next, FLOW.length - 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        html, body, #root { background: #0a1628; }
        body { font-family: 'DM Sans', system-ui, sans-serif; color: #fff; margin: 0; }
        input[type=range] { -webkit-appearance: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(ellipse at top, #102a44 0%, #0a1628 55%, #060e1c 100%)",
          color: "#fff",
          padding: "20px 16px 40px",
        }}
      >
        <Nav screen={screen} onBack={back} canBack={step > 0 && screen !== "dashboard"} />
        <ProgressBar screen={screen} />
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <Screens d={d} set={set} screen={screen} go={go} />
        </div>
      </div>
    </>
  );
}

function Nav({ screen, onBack, canBack }: { screen: Screen; onBack: () => void; canBack: boolean }) {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: "-0.01em",
          background: "linear-gradient(135deg,#a8d5e2,#fff)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Heimili
      </div>
      {canBack ? (
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ← Back
        </button>
      ) : (
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          {screen === "dashboard" ? "Your plan" : ""}
        </span>
      )}
    </div>
  );
}

function ProgressBar({ screen }: { screen: Screen }) {
  const idx = INPUT_STEPS.indexOf(screen as (typeof INPUT_STEPS)[number]);
  if (idx < 0) return <div style={{ height: 30 }} />;
  const pct = ((idx + 1) / INPUT_STEPS.length) * 100;
  return (
    <div style={{ maxWidth: 480, margin: "0 auto 18px" }}>
      <div
        style={{
          height: 4,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "linear-gradient(90deg,#4a8fa8,#a8d5e2)",
            transition: "width 0.4s cubic-bezier(.5,0,.2,1)",
          }}
        />
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          fontFamily: "'DM Mono', monospace",
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.1em",
        }}
      >
        {String(idx + 1).padStart(2, "0")} / {String(INPUT_STEPS.length).padStart(2, "0")}
      </div>
    </div>
  );
}

// ── Reusable bits ───────────────────────────────────────────────────────────

function Page({ keyId, children }: { keyId: string; children: React.ReactNode }) {
  return (
    <div key={keyId} style={{ animation: "fadeUp 0.45s cubic-bezier(.5,0,.2,1) both" }}>
      {children}
    </div>
  );
}

function Heading({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {kicker && (
        <div
          style={{
            fontSize: 11,
            fontFamily: "'DM Mono', monospace",
            color: "#a8d5e2",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          {kicker}
        </div>
      )}
      <h1
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 28,
          fontWeight: 900,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          margin: 0,
        }}
      >
        {title}
      </h1>
      {sub && (
        <p
          style={{
            marginTop: 12,
            fontSize: 14,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.5,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function Btn({
  onClick,
  disabled,
  children,
  variant = "primary",
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const base: React.CSSProperties = {
    border: "none",
    borderRadius: 14,
    padding: "17px 28px",
    fontSize: 15,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    width: "100%",
    letterSpacing: "0.01em",
    transition: "all 0.2s",
    fontFamily: "inherit",
  };
  const styles: React.CSSProperties =
    variant === "primary"
      ? {
          ...base,
          background: "linear-gradient(135deg,#4a8fa8,#a8d5e2)",
          color: "#0a1628",
          boxShadow: disabled ? "none" : "0 6px 24px rgba(74,143,168,0.28)",
          opacity: disabled ? 0.35 : 1,
        }
      : {
          ...base,
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.7)",
          border: "1.5px solid rgba(255,255,255,0.1)",
        };
  return (
    <button onClick={!disabled ? onClick : undefined} style={styles}>
      {children}
    </button>
  );
}

function SliderField({
  label,
  sublabel,
  value,
  min,
  max,
  step,
  format,
  onChange,
  onNext,
}: {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  onNext: () => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <>
      <Heading title={label} sub={sublabel} />
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 42,
          fontWeight: 700,
          color: "#a8d5e2",
          marginBottom: 24,
          textAlign: "center",
          letterSpacing: "-0.02em",
        }}
      >
        {format(value)}
      </div>
      <div style={{ position: "relative", height: 36, marginBottom: 8 }}>
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 0,
            right: 0,
            height: 4,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 4,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 0,
            width: `${pct}%`,
            height: 4,
            background: "linear-gradient(90deg,#4a8fa8,#a8d5e2)",
            borderRadius: 4,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 8,
            left: `calc(${pct}% - 10px)`,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#a8d5e2",
            boxShadow: "0 4px 12px rgba(168,213,226,0.5)",
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
            opacity: 0,
            width: "100%",
            cursor: "pointer",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          fontFamily: "'DM Mono', monospace",
          color: "rgba(255,255,255,0.3)",
          marginBottom: 32,
        }}
      >
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
      <Btn onClick={onNext}>Continue →</Btn>
    </>
  );
}

function ChoiceList<T extends string | number>({
  options,
  value,
  onSelect,
  multi,
}: {
  options: { val: T; label: string; desc?: string; right?: string; color?: string }[];
  value: T | T[] | null;
  onSelect: (v: T) => void;
  multi?: boolean;
}) {
  const isActive = (v: T) =>
    multi && Array.isArray(value) ? value.includes(v) : value === v;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
      {options.map((o) => {
        const active = isActive(o.val);
        return (
          <button
            key={String(o.val)}
            onClick={() => onSelect(o.val)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: active ? "rgba(168,213,226,0.12)" : "rgba(255,255,255,0.03)",
              border: active
                ? `1.5px solid ${o.color ? o.color + "70" : "rgba(168,213,226,0.55)"}`
                : "1.5px solid rgba(255,255,255,0.07)",
              borderRadius: 14,
              padding: "15px 18px",
              cursor: "pointer",
              transition: "all 0.18s",
              textAlign: "left",
              color: "#fff",
              fontFamily: "inherit",
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{o.label}</div>
              {o.desc && (
                <div
                  style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}
                >
                  {o.desc}
                </div>
              )}
            </div>
            {o.right && (
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {o.right}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function FactCard({
  icon,
  fact,
  context,
  source,
  onNext,
}: {
  icon: string;
  fact: string;
  context: string;
  source: string;
  onNext: () => void;
}) {
  return (
    <div style={{ paddingTop: 30, textAlign: "center" }}>
      <div
        style={{
          fontSize: 56,
          marginBottom: 24,
          animation: "fadeIn 0.7s",
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 11,
          fontFamily: "'DM Mono', monospace",
          color: "#a8d5e2",
          letterSpacing: "0.18em",
          marginBottom: 16,
        }}
      >
        DID YOU KNOW
      </div>
      <h2
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 26,
          fontWeight: 900,
          lineHeight: 1.2,
          margin: "0 0 18px",
        }}
      >
        {fact}
      </h2>
      <p
        style={{
          fontSize: 15,
          color: "rgba(255,255,255,0.6)",
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        {context}
      </p>
      <p
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.3)",
          marginBottom: 32,
          fontStyle: "italic",
        }}
      >
        {source}
      </p>
      <Btn onClick={onNext}>Got it →</Btn>
    </div>
  );
}

// ── Screens dispatcher ──────────────────────────────────────────────────────

function Screens({
  d,
  set,
  screen,
  go,
}: {
  d: Data;
  set: <K extends keyof Data>(k: K, v: Data[K]) => void;
  screen: Screen;
  go: () => void;
}) {
  if (screen === "welcome")
    return (
      <Page keyId={screen}>
        <div style={{ paddingTop: 40, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 28 }}>🏡</div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 38,
              fontWeight: 900,
              lineHeight: 1.1,
              margin: "0 0 16px",
            }}
          >
            Your path to a first home
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.55,
              marginBottom: 36,
            }}
          >
            In about 3 minutes, Heimili builds you a personalized investment, affordability, and
            readiness plan — for free.
          </p>
          <Btn onClick={go}>Get Started →</Btn>
          <p
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              marginTop: 18,
            }}
          >
            No account required · No credit pulled
          </p>
        </div>
      </Page>
    );

  if (screen === "email")
    return (
      <Page keyId={screen}>
        <Heading
          kicker="Step 1"
          title="Where should we send your plan?"
          sub="We'll save your results so you can come back to them anytime."
        />
        <input
          type="email"
          placeholder="you@email.com"
          value={d.email}
          onChange={(e) => set("email", e.target.value)}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.05)",
            border: "1.5px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            padding: "17px 18px",
            color: "#fff",
            fontSize: 15,
            marginBottom: 20,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <Btn onClick={go} disabled={!d.email.includes("@")}>
          Continue →
        </Btn>
        <button
          onClick={go}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.3)",
            fontSize: 13,
            cursor: "pointer",
            marginTop: 14,
            width: "100%",
            padding: 8,
          }}
        >
          Skip for now
        </button>
      </Page>
    );

  if (screen === "age")
    return (
      <Page keyId={screen}>
        <SliderField
          label="How old are you?"
          sublabel="Age helps us calibrate your timeline."
          value={d.age}
          min={18}
          max={75}
          step={1}
          format={(v) => `${v} years`}
          onChange={(v) => set("age", v)}
          onNext={go}
        />
      </Page>
    );

  if (screen === "fact1") return <FactCard {...FACTS.fact1} onNext={go} />;

  if (screen === "income")
    return (
      <Page keyId={screen}>
        <SliderField
          label="What's your annual income?"
          sublabel="Gross income, before taxes."
          value={d.income}
          min={20000}
          max={500000}
          step={1000}
          format={fmt}
          onChange={(v) => set("income", v)}
          onNext={go}
        />
      </Page>
    );

  if (screen === "expenses")
    return (
      <Page keyId={screen}>
        <SliderField
          label="Monthly living expenses?"
          sublabel="Rent, groceries, utilities, subscriptions — the essentials."
          value={d.expenses}
          min={500}
          max={15000}
          step={50}
          format={(v) => fmt(v) + "/mo"}
          onChange={(v) => set("expenses", v)}
          onNext={go}
        />
      </Page>
    );

  if (screen === "debt")
    return (
      <Page keyId={screen}>
        <SliderField
          label="Monthly debt payments?"
          sublabel="Student loans, car payments, credit cards."
          value={d.debt}
          min={0}
          max={5000}
          step={50}
          format={(v) => (v === 0 ? "None" : fmt(v) + "/mo")}
          onChange={(v) => set("debt", v)}
          onNext={go}
        />
      </Page>
    );

  if (screen === "credit")
    return (
      <Page keyId={screen}>
        <Heading title="What's your credit score?" sub="Pick the range that best describes you." />
        <ChoiceList
          options={CREDIT_BUCKETS.map((b) => ({
            val: b.value,
            label: b.label,
            desc: b.desc,
            right: b.range,
            color: b.color,
          }))}
          value={d.credit}
          onSelect={(v) => set("credit", v)}
        />
        <Btn onClick={go} disabled={!d.credit}>
          Continue →
        </Btn>
      </Page>
    );

  if (screen === "savings")
    return (
      <Page keyId={screen}>
        <SliderField
          label="Current savings"
          sublabel="Anything you could put toward a home — checking, savings, brokerage."
          value={d.saved}
          min={0}
          max={200000}
          step={500}
          format={fmt}
          onChange={(v) => set("saved", v)}
          onNext={go}
        />
      </Page>
    );

  if (screen === "fact2") return <FactCard {...FACTS.fact2} onNext={go} />;

  if (screen === "partner")
    return (
      <Page keyId={screen}>
        <Heading
          title="Buying with a partner?"
          sub="Combining incomes and credit can change everything."
        />
        <ChoiceList
          options={[
            { val: "yes" as string, label: "Yes — buying together", desc: "Add their finances next" },
            { val: "no" as string, label: "Just me", desc: "Solo buyer" },
          ]}
          value={d.hasPartner === null ? null : d.hasPartner ? "yes" : "no"}
          onSelect={(v) => set("hasPartner", v === "yes")}
        />
        <Btn onClick={go} disabled={d.hasPartner === null}>
          Continue →
        </Btn>
      </Page>
    );

  if (screen === "partnerIncome")
    return (
      <Page keyId={screen}>
        <SliderField
          label="Partner's annual income?"
          value={d.partnerIncome}
          min={0}
          max={500000}
          step={1000}
          format={fmt}
          onChange={(v) => set("partnerIncome", v)}
          onNext={go}
        />
      </Page>
    );

  if (screen === "partnerExpenses")
    return (
      <Page keyId={screen}>
        <SliderField
          label="Partner's monthly expenses?"
          value={d.partnerExpenses}
          min={0}
          max={15000}
          step={50}
          format={(v) => fmt(v) + "/mo"}
          onChange={(v) => set("partnerExpenses", v)}
          onNext={go}
        />
      </Page>
    );

  if (screen === "partnerDebt")
    return (
      <Page keyId={screen}>
        <SliderField
          label="Partner's monthly debt?"
          value={d.partnerDebt}
          min={0}
          max={5000}
          step={50}
          format={(v) => (v === 0 ? "None" : fmt(v) + "/mo")}
          onChange={(v) => set("partnerDebt", v)}
          onNext={go}
        />
      </Page>
    );

  if (screen === "partnerCredit")
    return (
      <Page keyId={screen}>
        <Heading title="Partner's credit score?" sub="The lower of the two is what lenders use." />
        <ChoiceList
          options={CREDIT_BUCKETS.map((b) => ({
            val: b.value,
            label: b.label,
            desc: b.desc,
            right: b.range,
            color: b.color,
          }))}
          value={d.partnerCredit}
          onSelect={(v) => set("partnerCredit", v)}
        />
        <Btn onClick={go} disabled={!d.partnerCredit}>
          Continue →
        </Btn>
      </Page>
    );

  if (screen === "fact3") return <FactCard {...FACTS.fact3} onNext={go} />;

  if (screen === "zip") {
    const lookup = () => {
      if (d.zip.length === 5) {
        const z = getPriceByZip(d.zip);
        set("zipData", z);
      }
    };
    return (
      <Page keyId={screen}>
        <Heading
          title="Where do you want to buy?"
          sub="Your ZIP code helps us estimate local home prices."
        />
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={5}
          placeholder="00000"
          value={d.zip}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 5);
            set("zip", v);
            if (v.length === 5) {
              set("zipData", getPriceByZip(v));
            } else {
              set("zipData", null);
            }
          }}
          onBlur={lookup}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.05)",
            border: "1.5px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            padding: "17px 18px",
            color: "#fff",
            fontSize: 22,
            fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.3em",
            textAlign: "center",
            marginBottom: 20,
            outline: "none",
          }}
        />
        {d.zipData && (
          <div
            style={{
              background: "rgba(168,213,226,0.08)",
              border: "1.5px solid rgba(168,213,226,0.2)",
              borderRadius: 14,
              padding: "14px 18px",
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              Avg home price in {d.zipData.city}
            </div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 22,
                fontWeight: 700,
                color: "#a8d5e2",
                marginTop: 4,
              }}
            >
              {fmt(d.zipData.avg)}
            </div>
          </div>
        )}
        <Btn onClick={go} disabled={d.zip.length < 5}>
          Continue →
        </Btn>
      </Page>
    );
  }

  if (screen === "homeStyle")
    return (
      <Page keyId={screen}>
        <Heading title="What kind of home?" sub="Pick all that interest you." />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {HOME_STYLES.map((s) => {
            const active = d.homeStyles.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => {
                  set(
                    "homeStyles",
                    active ? d.homeStyles.filter((x) => x !== s.id) : [...d.homeStyles, s.id],
                  );
                }}
                style={{
                  background: active ? "rgba(168,213,226,0.12)" : "rgba(255,255,255,0.03)",
                  border: active
                    ? "1.5px solid rgba(168,213,226,0.55)"
                    : "1.5px solid rgba(255,255,255,0.07)",
                  borderRadius: 14,
                  padding: "18px 12px",
                  cursor: "pointer",
                  textAlign: "center",
                  color: "#fff",
                  transition: "all 0.18s",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>{s.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.label}</div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.45)",
                    marginTop: 4,
                    lineHeight: 1.3,
                  }}
                >
                  {s.note}
                </div>
              </button>
            );
          })}
        </div>
        <Btn onClick={go} disabled={d.homeStyles.length === 0}>
          Continue →
        </Btn>
      </Page>
    );

  if (screen === "timeline")
    return (
      <Page keyId={screen}>
        <SliderField
          label="When do you want to buy?"
          sublabel="A realistic timeline shapes your investment plan."
          value={d.timelineYears}
          min={1}
          max={10}
          step={1}
          format={(v) => `${v} year${v > 1 ? "s" : ""}`}
          onChange={(v) => set("timelineYears", v)}
          onNext={go}
        />
      </Page>
    );

  if (screen === "downPct")
    return (
      <Page keyId={screen}>
        <Heading
          title="Down payment plan?"
          sub="More down = lower monthly payment and no PMI at 20%."
        />
        <ChoiceList
          options={[
            { val: 3.5, label: "3.5%", desc: "FHA loan · lowest barrier to entry" },
            { val: 5, label: "5%", desc: "Common first step — lower upfront cost" },
            { val: 10, label: "10%", desc: "Solid middle ground" },
            { val: 20, label: "20%", desc: "No PMI · best mortgage rates" },
          ]}
          value={d.downPct}
          onSelect={(v) => set("downPct", v)}
        />
        <Btn onClick={go}>Continue →</Btn>
      </Page>
    );

  if (screen === "fact4") return <FactCard {...FACTS.fact4} onNext={go} />;

  if (screen.startsWith("risk")) {
    const idx = Number(screen.replace("risk", ""));
    const q = RISK_QS[idx];
    const value = d.riskAnswers[idx];
    return (
      <Page keyId={screen}>
        <Heading kicker={`Risk · ${idx + 1} of 4`} title={q.q} />
        <ChoiceList
          options={q.opts.map((o) => ({ val: o.val, label: o.label }))}
          value={value ?? null}
          onSelect={(v) =>
            set("riskAnswers", { ...d.riskAnswers, [idx]: v as number })
          }
        />
        <Btn onClick={go} disabled={value === undefined}>
          Continue →
        </Btn>
      </Page>
    );
  }

  if (screen === "dashboard") return <Dashboard d={d} />;

  return null;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ d }: { d: Data }) {
  const [tab, setTab] = useState<"invest" | "afford" | "ready">("invest");

  const zipData = d.zipData ?? { city: "your area", avg: 400000 };
  const styleAdj = useMemo(() => styleAdjustments(d.homeStyles), [d.homeStyles]);
  const avgPrice = Math.round(zipData.avg * styleAdj.priceMult);
  const effectiveDownPct = Math.max(d.downPct, styleAdj.minDown);
  const downPayment = Math.round((avgPrice * effectiveDownPct) / 100);
  const months = d.timelineYears * 12;
  const risk = useMemo(() => deriveRisk(d.riskAnswers), [d.riskAnswers]);

  const hasPartner = d.hasPartner === true;
  const combinedIncome = d.income + (hasPartner ? d.partnerIncome : 0);
  const combinedExpenses = d.expenses + (hasPartner ? d.partnerExpenses : 0);
  const combinedDebt = d.debt + (hasPartner ? d.partnerDebt : 0);
  const qualifyingCredit = hasPartner && d.partnerCredit
    ? Math.min(d.credit ?? 700, d.partnerCredit)
    : d.credit ?? 700;

  const primaryMonthly = calcRequiredMonthly(d.saved, downPayment, months, risk.rate);
  const savingsOnly = calcRequiredMonthly(d.saved, downPayment, months, 0);

  // Affordability
  const mortgage = calcMortgage(avgPrice, effectiveDownPct);
  const taxIns = (avgPrice * 0.018) / 12; // ~1.8% annual property tax + insurance
  const pmi = effectiveDownPct < 20 ? (avgPrice * (1 - effectiveDownPct / 100) * 0.005) / 12 : 0;
  const hoa = styleAdj.hoa;
  const reserve = styleAdj.reserve;
  const totalHousing = mortgage + taxIns + pmi + hoa + reserve;
  const monthlyIncome = combinedIncome / 12;
  const housingRatio = totalHousing / monthlyIncome;
  const affordable = housingRatio <= 0.28;
  const stretching = !affordable && housingRatio <= 0.36;

  const eFundMin = combinedExpenses * 3;
  const eFundMax = combinedExpenses * 6;
  const eFundOk = d.saved >= eFundMin;

  // Readiness 0-100
  const creditScore = Math.max(0, Math.min(100, ((qualifyingCredit - 580) / (820 - 580)) * 100));
  const dti = (combinedDebt + totalHousing) / monthlyIncome;
  const dtiScore = Math.max(0, Math.min(100, (1 - (dti - 0.28) / 0.2) * 100));
  const savingsScore = Math.max(0, Math.min(100, (d.saved / downPayment) * 100));
  const timelineScore = Math.max(0, Math.min(100, (d.timelineYears / 5) * 100));
  const readiness = Math.round(
    creditScore * 0.3 + dtiScore * 0.3 + savingsScore * 0.25 + timelineScore * 0.15,
  );

  const styleNames = d.homeStyles
    .map((id) => HOME_STYLES.find((s) => s.id === id)?.label)
    .filter(Boolean)
    .join(", ");

  return (
    <div style={{ animation: "fadeUp 0.5s both" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#a8d5e2",
            marginBottom: 6,
            fontFamily: "'DM Mono', monospace",
          }}
        >
          Your Path Home
        </div>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 900,
            fontFamily: "'Playfair Display', serif",
            lineHeight: 1.2,
            margin: "0 0 6px",
          }}
        >
          {styleNames || "Your Home"} in {zipData.city}
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
          {fmt(avgPrice)} avg · {d.downPct}% down ={" "}
          <span style={{ color: "#a8d5e2", fontWeight: 700 }}>{fmt(downPayment)}</span>
          {hasPartner && (
            <span style={{ color: "rgba(255,255,255,0.35)" }}> · Buying together</span>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          background: "rgba(255,255,255,0.04)",
          padding: 4,
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        {[
          { key: "invest", label: "Invest" },
          { key: "afford", label: "Afford" },
          { key: "ready", label: "Ready" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            style={{
              flex: 1,
              border: "none",
              borderRadius: 9,
              padding: "10px 4px",
              cursor: "pointer",
              background: tab === t.key ? "rgba(168,213,226,0.16)" : "transparent",
              color: tab === t.key ? "#a8d5e2" : "rgba(255,255,255,0.32)",
              fontWeight: 700,
              fontSize: 12,
              transition: "all 0.2s",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontFamily: "inherit",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "invest" && (
        <div>
          <StatCard
            label={`${risk.label} strategy · ${d.timelineYears}-year goal`}
            value={fmt(primaryMonthly) + "/mo"}
            sub={`Invest this monthly to reach ${fmt(downPayment)} in ${d.timelineYears} years.`}
            color={risk.color}
          >
            {savingsOnly > primaryMonthly && (
              <div
                style={{
                  fontSize: 13,
                  color: "#86efac",
                  marginTop: 10,
                  fontWeight: 600,
                }}
              >
                💚 {fmt(savingsOnly - primaryMonthly)}/mo less than saving alone
              </div>
            )}
          </StatCard>

          <SectionHeader>All Three Strategies</SectionHeader>
          {STRATEGIES.map((s) => {
            const m = calcRequiredMonthly(d.saved, downPayment, months, s.rate);
            const isMatch = s.label === risk.label;
            return (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: isMatch
                    ? "rgba(168,213,226,0.1)"
                    : "rgba(255,255,255,0.03)",
                  border: isMatch
                    ? "1.5px solid rgba(168,213,226,0.4)"
                    : "1.5px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: s.color,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: isMatch ? "#fff" : "rgba(255,255,255,0.6)",
                      }}
                    >
                      {s.label}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                      {s.desc}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 700,
                    color: isMatch ? "#a8d5e2" : "rgba(255,255,255,0.5)",
                    fontSize: 14,
                  }}
                >
                  {fmt(m)}/mo
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "afford" && (
        <div>
          <div
            style={{
              background: affordable
                ? "rgba(74,222,128,0.07)"
                : stretching
                  ? "rgba(251,191,36,0.07)"
                  : "rgba(248,113,113,0.07)",
              border: `1.5px solid ${
                affordable
                  ? "rgba(74,222,128,0.25)"
                  : stretching
                    ? "rgba(251,191,36,0.25)"
                    : "rgba(248,113,113,0.25)"
              }`,
              borderRadius: 16,
              padding: 20,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: affordable ? "#4ade80" : stretching ? "#fbbf24" : "#f87171",
                marginBottom: 8,
              }}
            >
              {affordable
                ? "✅ Looks Affordable"
                : stretching
                  ? "⚠️ A Bit of a Stretch"
                  : "❌ May Be Difficult"}
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 900,
                fontFamily: "'DM Mono', monospace",
                color: "#fff",
                marginBottom: 6,
              }}
            >
              {fmt(totalHousing)}/mo
            </div>
            <div
              style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}
            >
              Estimated all-in monthly housing — that's{" "}
              <strong style={{ color: "#fff" }}>{Math.round(housingRatio * 100)}%</strong> of
              your income.{" "}
              {affordable
                ? "Lenders prefer under 28% — you're in good shape."
                : "Lenders prefer under 28%."}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
                marginTop: 14,
              }}
            >
              {[
                { label: "P & I", val: fmt(mortgage) },
                {
                  label: d.downPct < 20 ? "PMI" : "No PMI",
                  val: d.downPct < 20 ? fmt(pmi) : "—",
                },
                { label: "Tax & Ins", val: fmt(taxIns) },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: 10,
                    padding: "10px 8px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.05em",
                      marginBottom: 4,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {item.val}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <SectionHeader>Emergency Fund</SectionHeader>
          <div
            style={{
              background: eFundOk ? "rgba(74,222,128,0.07)" : "rgba(251,191,36,0.07)",
              border: `1.5px solid ${
                eFundOk ? "rgba(74,222,128,0.25)" : "rgba(251,191,36,0.25)"
              }`,
              borderRadius: 16,
              padding: 18,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: eFundOk ? "#4ade80" : "#fbbf24",
                marginBottom: 8,
              }}
            >
              {eFundOk ? "✅ Emergency Fund on Track" : "⚠️ Build Your Emergency Fund"}
            </div>
            <div
              style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}
            >
              We recommend{" "}
              <strong style={{ color: "#fff" }}>
                {fmt(eFundMin)} – {fmt(eFundMax)}
              </strong>{" "}
              in cash.{" "}
              {eFundOk
                ? `You have ${fmt(d.saved)} saved. You're covered.`
                : `You have ${fmt(d.saved)} — short of the minimum.`}
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.07)",
                borderRadius: 4,
                height: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 4,
                  width: `${Math.min(100, (d.saved / eFundMax) * 100)}%`,
                  background: eFundOk ? "#4ade80" : "#fbbf24",
                  transition: "width 0.5s",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 6,
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              <span>{fmt(d.saved)} saved</span>
              <span>{fmt(eFundMax)} target</span>
            </div>
          </div>

          <SectionHeader>Income & Debt</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <MiniStat
              label={hasPartner ? "Combined Income" : "Income"}
              value={fmt(combinedIncome)}
            />
            <MiniStat label="Monthly DTI" value={`${Math.round(dti * 100)}%`} />
          </div>
        </div>
      )}

      {tab === "ready" && (
        <div>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1.5px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 14,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.5)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Readiness Score
            </div>
            <div
              style={{
                fontSize: 72,
                fontFamily: "'DM Mono', monospace",
                fontWeight: 700,
                lineHeight: 1,
                color:
                  readiness >= 70 ? "#4ade80" : readiness >= 45 ? "#fbbf24" : "#f87171",
              }}
            >
              {readiness}
            </div>
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.5)",
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              {readiness >= 70
                ? "You're in great shape — start talking to lenders."
                : readiness >= 45
                  ? "A few improvements will meaningfully boost your eligibility."
                  : "Focus on credit and debt reduction first — biggest payoff."}
            </div>
          </div>

          <SectionHeader>The Numbers</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <MiniStat
              label={`Credit${hasPartner ? " (qual.)" : ""}`}
              value={String(qualifyingCredit)}
            />
            <MiniStat label="DTI Ratio" value={`${Math.round(dti * 100)}%`} />
            <MiniStat label="Saved" value={fmt(d.saved)} />
            <MiniStat
              label="To Go"
              value={fmt(Math.max(0, downPayment - d.saved))}
            />
          </div>

          <div
            style={{
              marginTop: 18,
              background: "rgba(168,213,226,0.06)",
              border: "1.5px solid rgba(168,213,226,0.2)",
              borderRadius: 14,
              padding: 16,
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "#a8d5e2" }}>Next step:</strong>{" "}
            {readiness >= 70
              ? "Get pre-approved with 2–3 lenders to lock in your rate."
              : qualifyingCredit < 670
                ? "Pay down credit balances to under 30% utilization to lift your score."
                : combinedDebt > monthlyIncome * 0.15
                  ? "Reduce monthly debt to widen your borrowing capacity."
                  : "Keep investing monthly — you're building the down payment runway."}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1.5px solid ${color ? color + "40" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 16,
        padding: 20,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.5)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 900,
          fontFamily: "'DM Mono', monospace",
          color: color || "#fff",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.5)",
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          {sub}
        </div>
      )}
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontFamily: "'DM Mono', monospace",
        color: "rgba(255,255,255,0.4)",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        marginTop: 22,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1.5px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          fontFamily: "'DM Mono', monospace",
          color: "#fff",
        }}
      >
        {value}
      </div>
    </div>
  );
}
