import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updatePlanMeta } from "@/lib/plans.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { CREDIT_BUCKETS } from "@/lib/keystone";

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  sage: "#2d7a4f",
};

type AnswersPatch = {
  income?: number;
  partnerIncome?: number;
  monthlyExpenses?: number;
  partnerMonthlyExpenses?: number;
  debt?: number;
  partnerDebt?: number;
  credit?: number | null;
  partnerCredit?: number | null;
  hasPartner?: boolean;
};

type Props = {
  planId: string;
  planTitle: string | null;
  shareSlug: string | null;
  shareEnabled: boolean;
  answers: Record<string, unknown>;
  assumptions: Record<string, number> | null;
  currentSavings: number | null;
};

const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");
const fmtMoney = (n: number) => (n > 0 ? n.toLocaleString("en-US") : "");
const num = (a: Record<string, unknown>, k: string, fb = 0): number => {
  const v = a[k];
  return typeof v === "number" && isFinite(v) ? v : fb;
};
const bool = (a: Record<string, unknown>, k: string): boolean => a[k] === true;
const nNum = (a: Record<string, unknown>, k: string): number | null => {
  const v = a[k];
  return typeof v === "number" && isFinite(v) ? v : null;
};

export function EditablePlanPanel({
  planId,
  answers,
  currentSavings,
}: Props) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updatePlanMeta);
  const env = getStripeEnvironment();

  const [income, setIncome] = useState(fmtMoney(num(answers, "income")));
  const [partnerIncome, setPartnerIncome] = useState(fmtMoney(num(answers, "partnerIncome")));
  const [monthlyExpenses, setMonthlyExpenses] = useState(fmtMoney(num(answers, "monthlyExpenses")));
  const [partnerMonthlyExpenses, setPartnerMonthlyExpenses] = useState(
    fmtMoney(num(answers, "partnerMonthlyExpenses")),
  );
  const [debt, setDebt] = useState(fmtMoney(num(answers, "debt")));
  const [partnerDebt, setPartnerDebt] = useState(fmtMoney(num(answers, "partnerDebt")));
  const [credit, setCredit] = useState<string>(
    nNum(answers, "credit") != null ? String(nNum(answers, "credit")) : "",
  );
  const [partnerCredit, setPartnerCredit] = useState<string>(
    nNum(answers, "partnerCredit") != null ? String(nNum(answers, "partnerCredit")) : "",
  );
  const [hasPartner, setHasPartner] = useState<boolean>(bool(answers, "hasPartner"));

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const parsed = useMemo(
    () => ({
      income: Number(onlyDigits(income) || 0),
      partnerIncome: Number(onlyDigits(partnerIncome) || 0),
      monthlyExpenses: Number(onlyDigits(monthlyExpenses) || 0),
      partnerMonthlyExpenses: Number(onlyDigits(partnerMonthlyExpenses) || 0),
      debt: Number(onlyDigits(debt) || 0),
      partnerDebt: Number(onlyDigits(partnerDebt) || 0),
      credit: credit === "" ? null : Number(credit),
      partnerCredit: partnerCredit === "" ? null : Number(partnerCredit),
    }),
    [income, partnerIncome, monthlyExpenses, partnerMonthlyExpenses, debt, partnerDebt, credit, partnerCredit],
  );

  const mut = useMutation({
    mutationFn: (vars: { answersPatch: AnswersPatch }) =>
      updateFn({
        data: {
          planId,
          currentSavings: currentSavings ?? 0,
          answersPatch: vars.answersPatch,
          environment: env,
        } as never,
      }),
    onMutate: () => setStatus("saving"),
    onSuccess: () => {
      setStatus("saved");
      qc.invalidateQueries({ queryKey: ["my-plans"] });
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    },
    onError: () => setStatus("error"),
  });

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      mut.mutate({
        answersPatch: {
          income: parsed.income,
          partnerIncome: parsed.partnerIncome,
          monthlyExpenses: parsed.monthlyExpenses,
          partnerMonthlyExpenses: parsed.partnerMonthlyExpenses,
          debt: parsed.debt,
          partnerDebt: parsed.partnerDebt,
          credit: parsed.credit,
          partnerCredit: parsed.partnerCredit,
          hasPartner,
        },
      });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, hasPartner]);

  return (
    <div
      style={{
        border: `1.5px solid ${C.ink}`,
        borderRadius: 12,
        padding: 22,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.ember,
          }}
        >
          Your finances
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color:
              status === "error"
                ? C.ember
                : status === "saving"
                  ? C.inkMute
                  : status === "saved"
                    ? C.sage
                    : C.inkFaint,
          }}
        >
          {status === "saving"
            ? "Saving…"
            : status === "saved"
              ? "✓ Saved"
              : status === "error"
                ? "Save failed"
                : "Auto-saves as you type"}
        </div>
      </div>

      <Section title="You">
        <Grid>
          <MoneyField label="Annual income" value={income} onChange={setIncome} />
          <MoneyField label="Monthly expenses" value={monthlyExpenses} onChange={setMonthlyExpenses} />
          <MoneyField label="Monthly debt payments" value={debt} onChange={setDebt} />
          <SelectField
            label="Credit score"
            value={credit}
            onChange={setCredit}
            options={[
              { value: "", label: "—" },
              ...CREDIT_BUCKETS.map((b) => ({ value: String(b.value), label: `${b.label} (${b.range})` })),
            ]}
          />
        </Grid>
      </Section>

      <Section title="Partner">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            color: C.inkSoft,
            marginBottom: hasPartner ? 14 : 0,
          }}
        >
          <input
            type="checkbox"
            checked={hasPartner}
            onChange={(e) => setHasPartner(e.target.checked)}
          />
          Buying with a partner
        </label>
        {hasPartner && (
          <Grid>
            <MoneyField label="Partner annual income" value={partnerIncome} onChange={setPartnerIncome} />
            <MoneyField
              label="Partner monthly expenses"
              value={partnerMonthlyExpenses}
              onChange={setPartnerMonthlyExpenses}
            />
            <MoneyField label="Partner monthly debt" value={partnerDebt} onChange={setPartnerDebt} />
            <SelectField
              label="Partner credit score"
              value={partnerCredit}
              onChange={setPartnerCredit}
              options={[
                { value: "", label: "—" },
                ...CREDIT_BUCKETS.map((b) => ({ value: String(b.value), label: `${b.label} (${b.range})` })),
              ]}
            />
          </Grid>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.inkMute,
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: `1px solid ${C.inkFaint}`,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: C.inkMute,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputBase: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${C.inkFaint}`,
  borderRadius: 6,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 14,
  fontVariantNumeric: "tabular-nums",
  color: C.ink,
  background: "#fff",
  boxSizing: "border-box",
  outline: "none",
};

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FieldShell label={label}>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: C.inkMute,
            fontSize: 14,
            pointerEvents: "none",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          $
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const digits = onlyDigits(e.target.value);
            onChange(digits ? Number(digits).toLocaleString("en-US") : "");
          }}
          placeholder="0"
          style={{ ...inputBase, paddingLeft: 22 }}
        />
      </div>
    </FieldShell>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <FieldShell label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputBase, paddingRight: 28 }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
