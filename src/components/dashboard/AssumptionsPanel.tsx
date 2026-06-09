import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { InvestSection } from "./InvestVsSavePanel";
import { deriveAssumptions } from "@/lib/plan-assumptions";
import { updatePlanMeta } from "@/lib/plans.functions";

const C = {
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  sage: "#5a8a5c",
};

type Stored = Record<string, number> | null;

// Storage-key contract matches `assumptionsSchema` in src/lib/plans.functions.ts.
type Field = {
  key:
    | "propertyTaxPct"
    | "insuranceAnnual"
    | "closingCostPct"
    | "movingCost"
    | "mortgageRatePct";
  label: string;
  suffix: string;
  step: number;
  /** Returns the derived/default value to show as a placeholder. */
  derivedFor: (args: {
    answers: Record<string, unknown>;
    targetPrice: number;
  }) => number;
};

const FIELDS: Field[] = [
  {
    key: "propertyTaxPct",
    label: "Property tax (annual)",
    suffix: "%",
    step: 0.01,
    derivedFor: ({ answers }) => deriveAssumptions(answers).propertyTaxRate * 100,
  },
  {
    key: "insuranceAnnual",
    label: "Homeowners insurance (annual)",
    suffix: "$",
    step: 50,
    derivedFor: ({ answers, targetPrice }) =>
      Math.round(deriveAssumptions(answers).insuranceRate * targetPrice),
  },
  {
    key: "closingCostPct",
    label: "Closing costs",
    suffix: "% of price",
    step: 0.1,
    derivedFor: ({ answers }) => deriveAssumptions(answers).closingCostPct,
  },
  {
    key: "movingCost",
    label: "Moving budget",
    suffix: "$",
    step: 50,
    derivedFor: ({ answers }) => deriveAssumptions(answers).movingCost,
  },
  {
    key: "mortgageRatePct",
    label: "Mortgage rate",
    suffix: "%",
    step: 0.05,
    // Leave blank → backend uses credit-based rate. Show 0 placeholder hint via empty.
    derivedFor: () => 0,
  },
];

export function AssumptionsPanel({
  planId,
  answers,
  targetPrice,
  assumptions,
  isPlus,
  locked,
  onLockedClick,
}: {
  planId: string;
  answers: Record<string, unknown>;
  targetPrice: number;
  assumptions: Stored;
  isPlus: boolean;
  locked: boolean;
  onLockedClick: () => void;
}) {
  const updateMeta = useServerFn(updatePlanMeta);
  const qc = useQueryClient();

  // Local form state — undefined = "use derived default".
  const initial: Record<string, number | undefined> = {};
  for (const f of FIELDS) initial[f.key] = assumptions?.[f.key];
  const [vals, setVals] = useState(initial);
  const initialDownPct = typeof answers.downGoalPct === "number" ? (answers.downGoalPct as number) : 9;
  const [downPct, setDownPct] = useState<number>(initialDownPct);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Re-sync when the underlying plan switches.
  useEffect(() => {
    const next: Record<string, number | undefined> = {};
    for (const f of FIELDS) next[f.key] = assumptions?.[f.key];
    setVals(next);
    setDownPct(typeof answers.downGoalPct === "number" ? (answers.downGoalPct as number) : 9);
  }, [planId, assumptions, answers]);

  // Optimistically patch the cached plan so every panel recomputes immediately.
  const patchCache = (nextAssumptions: Record<string, number>) => {
    qc.setQueryData(["my-plans"], (prev: unknown) => {
      if (!prev || typeof prev !== "object") return prev;
      const obj = prev as { plans?: unknown };
      if (!Array.isArray(obj.plans)) return prev;
      const nextPlans = obj.plans.map((p) =>
        p && typeof p === "object" && (p as { id?: string }).id === planId
          ? { ...p, assumptions: nextAssumptions }
          : p,
      );
      return { ...obj, plans: nextPlans };
    });
  };

  const save = async () => {
    if (!isPlus || locked) return;
    setSaving(true);
    try {
      // Preserve any keys we don't manage here (e.g. investMonthly from the slider).
      const next: Record<string, number> = { ...(assumptions ?? {}) };
      for (const f of FIELDS) {
        const v = vals[f.key];
        if (v == null || Number.isNaN(v)) {
          delete next[f.key];
        } else {
          next[f.key] = v;
        }
      }
      patchCache(next);
      await updateMeta({ data: { planId, assumptions: next } });
      qc.invalidateQueries({ queryKey: ["my-plans"] });
      setSavedAt(Date.now());
    } catch (e) {
      console.warn("[assumptions] save failed", e);
      qc.invalidateQueries({ queryKey: ["my-plans"] });
      alert("Couldn't save your assumptions. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!isPlus || locked) return;
    setSaving(true);
    try {
      const next: Record<string, number> = { ...(assumptions ?? {}) };
      for (const f of FIELDS) delete next[f.key];
      patchCache(next);
      await updateMeta({ data: { planId, assumptions: next } });
      qc.invalidateQueries({ queryKey: ["my-plans"] });
      const cleared: Record<string, number | undefined> = {};
      for (const f of FIELDS) cleared[f.key] = undefined;
      setVals(cleared);
      setSavedAt(Date.now());
    } catch (e) {
      console.warn("[assumptions] reset failed", e);
      qc.invalidateQueries({ queryKey: ["my-plans"] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <InvestSection
      eyebrow="— Assumptions"
      title="Tune the inputs."
      locked={locked}
      onLockedClick={onLockedClick}
      lockedCta="Unlock with Plus"
      requiredTier="plus"
    >
      <p style={{ color: C.inkSoft, fontSize: 15, lineHeight: 1.5, margin: "0 0 18px" }}>
        We auto-fill these from your metro. Override anything below and we'll
        recalculate your plan. Leave a field blank to use the default.
      </p>

      <div style={{ display: "grid", gap: 16 }}>
        {FIELDS.map((f) => {
          const derived = f.derivedFor({ answers, targetPrice });
          const placeholder =
            f.key === "mortgageRatePct"
              ? "auto from credit"
              : String(Math.round(derived * 100) / 100);
          return (
            <label key={f.key} style={{ display: "block" }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: C.inkMute,
                  marginBottom: 6,
                }}
              >
                {f.label}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  borderBottom: `1px solid ${C.ink}`,
                  paddingBottom: 6,
                }}
              >
                <input
                  type="number"
                  step={f.step}
                  value={vals[f.key] ?? ""}
                  placeholder={placeholder}
                  onChange={(e) => {
                    const v = e.target.value;
                    setVals((prev) => ({
                      ...prev,
                      [f.key]: v === "" ? undefined : Number(v),
                    }));
                  }}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 20,
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    color: C.ink,
                  }}
                />
                <span style={{ fontSize: 12, color: C.inkMute }}>{f.suffix}</span>
              </div>
            </label>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 22, alignItems: "center" }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding: "10px 18px",
            background: C.ink,
            color: "#f5efe6",
            border: "none",
            borderRadius: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Save overrides"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={saving}
          style={{
            padding: "10px 18px",
            background: "transparent",
            color: C.ink,
            border: `1.5px solid ${C.ink}`,
            borderRadius: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: saving ? "default" : "pointer",
          }}
        >
          Reset to defaults
        </button>
        {savedAt && (
          <span style={{ fontSize: 12, color: C.sage, marginLeft: 4 }}>Saved ✓</span>
        )}
      </div>
    </InvestSection>
  );
}
