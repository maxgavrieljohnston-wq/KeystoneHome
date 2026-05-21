import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updatePlanMeta } from "@/lib/plans.functions";
import { computePlanMetrics } from "@/lib/plan-metrics";
import { getStripeEnvironment } from "@/lib/stripe";

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
};

type Snapshot = {
  targetPrice: number;
  currentSavings: number;
  monthlySavings: number;
  hadOverride: boolean;
};

type Props = {
  planId: string;
  answers: Record<string, unknown>;
  assumptions: Record<string, number> | null;
  currentSavings: number | null;
};

const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");
const fmtInput = (n: number) => (n > 0 ? n.toLocaleString("en-US") : "");

export function EditablePlanPanel({ planId, answers, assumptions, currentSavings }: Props) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updatePlanMeta);
  const env = getStripeEnvironment();

  // Snapshot of the "original" values, captured once on first mount.
  const snapshotRef = useRef<Snapshot | null>(null);
  if (snapshotRef.current === null) {
    const metrics = computePlanMetrics(answers, assumptions);
    const overrideRaw = answers.targetPriceOverride;
    const hadOverride =
      typeof overrideRaw === "number" && isFinite(overrideRaw) && overrideRaw > 0;
    const stated =
      typeof answers.monthlySavings === "number" && isFinite(answers.monthlySavings)
        ? (answers.monthlySavings as number)
        : 0;
    snapshotRef.current = {
      // If there's no override we snapshot the computed price (so revert
      // brings the user back to the "real" answer-derived value).
      targetPrice: hadOverride ? (overrideRaw as number) : metrics.targetPrice,
      currentSavings: currentSavings ?? 0,
      monthlySavings: stated,
      hadOverride,
    };
  }
  const snap = snapshotRef.current;

  // Local input state — the source of truth while editing.
  const initialTarget = (() => {
    const ov = answers.targetPriceOverride;
    if (typeof ov === "number" && ov > 0) return ov;
    return computePlanMetrics(answers, assumptions).targetPrice;
  })();
  const initialMonthly =
    typeof answers.monthlySavings === "number" && isFinite(answers.monthlySavings)
      ? (answers.monthlySavings as number)
      : 0;

  const [target, setTarget] = useState<string>(fmtInput(initialTarget));
  const [savings, setSavings] = useState<string>(fmtInput(currentSavings ?? 0));
  const [monthly, setMonthly] = useState<string>(fmtInput(initialMonthly));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const parsed = useMemo(() => ({
    target: Number(onlyDigits(target) || 0),
    savings: Number(onlyDigits(savings) || 0),
    monthly: Number(onlyDigits(monthly) || 0),
  }), [target, savings, monthly]);

  const mut = useMutation({
    mutationFn: (vars: {
      targetPriceOverride: number | null;
      currentSavings: number;
      monthlySavings: number;
    }) =>
      updateFn({
        data: {
          planId,
          currentSavings: vars.currentSavings,
          answersPatch: {
            monthlySavings: vars.monthlySavings,
            targetPriceOverride: vars.targetPriceOverride,
          },
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

  // Debounced autosave whenever inputs change.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      // Treat the target field as an override whenever the user has set it,
      // even if it happens to equal the computed default — they edited it.
      const override = parsed.target > 0 ? parsed.target : null;
      mut.mutate({
        targetPriceOverride: override,
        currentSavings: parsed.savings,
        monthlySavings: parsed.monthly,
      });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.target, parsed.savings, parsed.monthly]);

  const dirty =
    parsed.target !== snap.targetPrice ||
    parsed.savings !== snap.currentSavings ||
    parsed.monthly !== snap.monthlySavings;

  const handleRevert = () => {
    setTarget(fmtInput(snap.targetPrice));
    setSavings(fmtInput(snap.currentSavings));
    setMonthly(fmtInput(snap.monthlySavings));
    mut.mutate({
      // If there was no override originally, clear it on revert.
      targetPriceOverride: snap.hadOverride ? snap.targetPrice : null,
      currentSavings: snap.currentSavings,
      monthlySavings: snap.monthlySavings,
    });
  };

  return (
    <div
      style={{
        border: `1.5px solid ${C.ink}`,
        borderRadius: 12,
        padding: 20,
        background: "#fff",
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
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
          Your numbers · live
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
                    ? "#2d7a4f"
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <Field label="Target home price" value={target} onChange={setTarget} />
        <Field label="Current savings" value={savings} onChange={setSavings} />
        <Field label="Monthly contribution" value={monthly} onChange={setMonthly} />
      </div>

      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: C.inkMute, lineHeight: 1.4 }}>
          Changes flow into your projections, recommended accounts, and any PDF/CSV you download.
        </div>
        <button
          type="button"
          onClick={handleRevert}
          disabled={!dirty}
          style={{
            padding: "8px 14px",
            background: "transparent",
            color: dirty ? C.ink : C.inkFaint,
            border: `1px solid ${dirty ? C.ink : C.inkFaint}`,
            borderRadius: 6,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            cursor: dirty ? "pointer" : "not-allowed",
          }}
        >
          ↺ Revert to original
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
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
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: C.inkMute,
            fontSize: 16,
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
          style={{
            width: "100%",
            padding: "10px 12px 10px 22px",
            border: `1px solid ${C.inkFaint}`,
            borderRadius: 6,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 15,
            fontVariantNumeric: "tabular-nums",
            color: C.ink,
            background: "#fff",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
      </div>
    </label>
  );
}
