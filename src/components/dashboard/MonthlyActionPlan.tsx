import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  buildActionPlan,
  deriveSignals,
  type ActionItem,
  type ActionPlanProgress,
  type Phase,
} from "@/lib/action-plan";
import { computeGoalProgress, computePlanMetrics } from "@/lib/plan-metrics";
import { updateActionPlanProgress } from "@/lib/plans.functions";

const C = {
  paper: "#f5efe6",
  paperSoft: "#ece5d5",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  sage: "#5a8a5c",
  gold: "#b88b3a",
};

const paceColor = (status: string) =>
  status === "behind" ? C.ember : status === "ahead" ? C.sage : C.gold;

const paceLabel = (status: string) =>
  status === "behind" ? "Behind pace" :
  status === "ahead" ? "Ahead of pace" :
  status === "on_track" ? "On pace" : "Pace pending";

export function MonthlyActionPlan({
  planId,
  planCreatedAt,
  answers,
  assumptions,
  currentSavings,
  targetMoveIn,
  shareEnabled,
  remindersEnabled,
  lenderDocCount,
  initialProgress,
}: {
  planId: string;
  planCreatedAt: string | null;
  answers: Record<string, unknown>;
  assumptions: Record<string, number> | null;
  currentSavings: number | null;
  targetMoveIn: string | null;
  shareEnabled: boolean;
  remindersEnabled: boolean;
  lenderDocCount: number;
  initialProgress: ActionPlanProgress | null;
}) {
  const persistFn = useServerFn(updateActionPlanProgress);
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(initialProgress?.checked ?? []),
  );
  const [dismissed, setDismissed] = useState<Set<string>>(
    () => new Set(initialProgress?.dismissed ?? []),
  );

  // When the user switches plans, re-sync from props.
  useEffect(() => {
    setChecked(new Set(initialProgress?.checked ?? []));
    setDismissed(new Set(initialProgress?.dismissed ?? []));
  }, [planId, initialProgress?.checked, initialProgress?.dismissed]);

  // Debounced persistence.
  useEffect(() => {
    const t = setTimeout(() => {
      persistFn({
        data: {
          planId,
          checked: [...checked],
          dismissed: [...dismissed],
        },
      }).catch((err) => console.error("[updateActionPlanProgress]", err));
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, dismissed, planId]);

  const plan = useMemo(() => {
    const metrics = computePlanMetrics(answers, assumptions);
    const goal = computeGoalProgress(metrics, currentSavings, targetMoveIn);
    const signals = deriveSignals({
      answers,
      lenderDocCount,
      remindersEnabled,
      shareEnabled,
      planCreatedAt,
    });
    return buildActionPlan({ metrics, goal, signals });
  }, [
    answers, assumptions, currentSavings, targetMoveIn,
    lenderDocCount, remindersEnabled, shareEnabled, planCreatedAt,
  ]);

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Progress counts (excluding dismissed items)
  const allMilestoneIds = useMemo(() => {
    const ids: string[] = [];
    for (const p of plan.phases) for (const m of p.milestones) ids.push(m.id);
    return ids;
  }, [plan]);
  const milestonesDone = allMilestoneIds.filter((id) => checked.has(id)).length;
  const milestonesTotal = allMilestoneIds.filter((id) => !dismissed.has(id)).length;

  const summary = plan.summary;

  return (
    <section
      style={{
        background: C.paper,
        border: `1px solid ${C.inkFaint}`,
        borderRadius: 16,
        padding: "28px 28px 24px",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: C.ink,
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: C.inkMute,
            marginBottom: 6,
          }}
        >
          — Your monthly action plan
        </div>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', 'Georgia', serif",
            fontSize: 30,
            fontWeight: 500,
            margin: "0 0 6px",
            letterSpacing: "-0.01em",
          }}
        >
          What to do, month by month.
        </h2>
        <p style={{ color: C.inkSoft, margin: 0, fontSize: 15, lineHeight: 1.5 }}>
          Personal to your timeline, savings pace, credit band, and docs uploaded.
          Check things off as you finish them.
        </p>
      </header>

      {/* Progress strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 16,
          padding: "16px",
          background: C.paperSoft,
          borderRadius: 10,
          marginBottom: 24,
        }}
      >
        <Stat
          label="Saved"
          value={`${Math.round(summary.pctToGoal)}%`}
          sub={`of ${fmtUsd(summary.goal)} goal`}
        />
        <Stat
          label="Move-in"
          value={summary.monthsToGoal != null ? fmtMonths(summary.monthsToGoal) : "—"}
          sub="to go"
        />
        <Stat
          label="Pace"
          value={paceLabel(summary.paceStatus)}
          valueColor={paceColor(summary.paceStatus)}
          sub={
            summary.paceDeltaMonths != null && summary.paceDeltaMonths !== 0
              ? `${summary.paceDeltaMonths > 0 ? "+" : ""}${summary.paceDeltaMonths} mo`
              : "vs. target"
          }
        />
        <Stat
          label="Milestones"
          value={`${milestonesDone} / ${milestonesTotal}`}
          sub="checked off"
        />
      </div>

      {/* This month */}
      <div
        style={{
          border: `2px solid ${C.ink}`,
          borderRadius: 12,
          padding: "18px 20px",
          marginBottom: 24,
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 12,
          }}
        >
          <h3
            style={{
              fontFamily: "'Cormorant Garamond', 'Georgia', serif",
              fontSize: 22,
              fontWeight: 600,
              margin: 0,
            }}
          >
            This month
          </h3>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: C.inkMute,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {plan.thisMonth
            .filter((item) => !dismissed.has(item.id))
            .map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                checked={checked.has(item.id)}
                onToggle={() => toggleCheck(item.id)}
                onDismiss={() => dismiss(item.id)}
              />
            ))}
          {plan.thisMonth.filter((i) => !dismissed.has(i.id)).length === 0 && (
            <li style={{ color: C.inkMute, fontStyle: "italic", fontSize: 14 }}>
              Nothing else for this month — you're set.
            </li>
          )}
        </ul>
      </div>

      {/* Phases */}
      <div style={{ display: "grid", gap: 12 }}>
        {plan.phases.map((phase) => (
          <PhaseAccordion
            key={phase.id}
            phase={phase}
            defaultOpen={phase.isCurrent}
            checked={checked}
            dismissed={dismissed}
            onToggle={toggleCheck}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.1em",
          color: C.inkMute,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'Cormorant Garamond', 'Georgia', serif",
          fontSize: 22,
          fontWeight: 600,
          lineHeight: 1.1,
          color: valueColor ?? C.ink,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.inkMute, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function ItemRow({
  item,
  checked,
  onToggle,
  onDismiss,
}: {
  item: ActionItem;
  checked: boolean;
  onToggle: () => void;
  onDismiss: () => void;
}) {
  const isExternal = item.cta?.href?.startsWith("http");
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "start",
        gap: 12,
        padding: "10px 0",
        borderBottom: `1px dashed ${C.inkFaint}`,
      }}
    >
      <button
        onClick={onToggle}
        aria-label={checked ? "Uncheck" : "Check"}
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          border: `1.5px solid ${checked ? C.sage : C.inkSoft}`,
          background: checked ? C.sage : "transparent",
          color: "#fff",
          fontSize: 13,
          cursor: "pointer",
          padding: 0,
          marginTop: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? "✓" : ""}
      </button>
      <div>
        <div
          style={{
            fontSize: 15,
            color: checked ? C.inkMute : C.ink,
            textDecoration: checked ? "line-through" : "none",
            lineHeight: 1.4,
          }}
        >
          {item.label}
        </div>
        {item.detail && (
          <div style={{ fontSize: 13, color: C.inkMute, marginTop: 2 }}>{item.detail}</div>
        )}
        {item.cta && (
          <div style={{ marginTop: 6 }}>
            {isExternal ? (
              <a
                href={item.cta.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12,
                  color: C.ember,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                {item.cta.label} ↗
              </a>
            ) : (
              <Link
                to={item.cta.href}
                style={{
                  fontSize: 12,
                  color: C.ember,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                {item.cta.label} →
              </Link>
            )}
          </div>
        )}
      </div>
      {!item.required && (
        <button
          onClick={onDismiss}
          title="Not applicable to me"
          aria-label="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: C.inkFaint,
            cursor: "pointer",
            fontSize: 14,
            padding: "0 4px",
          }}
        >
          ×
        </button>
      )}
    </li>
  );
}

function PhaseAccordion({
  phase,
  defaultOpen,
  checked,
  dismissed,
  onToggle,
  onDismiss,
}: {
  phase: Phase;
  defaultOpen: boolean;
  checked: Set<string>;
  dismissed: Set<string>;
  onToggle: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [monthsOpen, setMonthsOpen] = useState(false);
  const visibleMilestones = phase.milestones.filter((m) => !dismissed.has(m.id));
  const done = visibleMilestones.filter((m) => checked.has(m.id)).length;

  return (
    <div
      style={{
        border: `1px solid ${phase.isCurrent ? C.ink : C.inkFaint}`,
        borderRadius: 10,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span
            style={{
              fontFamily: "'Cormorant Garamond', 'Georgia', serif",
              fontSize: 20,
              fontWeight: 600,
              color: C.ink,
            }}
          >
            {phase.label}
          </span>
          {phase.isCurrent && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: C.ember,
                background: "rgba(196,69,45,0.1)",
                padding: "2px 6px",
                borderRadius: 3,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              You are here
            </span>
          )}
          <span style={{ fontSize: 12, color: C.inkMute }}>{phase.monthRange}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 12, color: C.inkMute, fontVariantNumeric: "tabular-nums" }}>
            {done}/{visibleMilestones.length}
          </span>
          <span style={{ color: C.inkSoft, fontSize: 14 }}>{open ? "−" : "+"}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {visibleMilestones.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                checked={checked.has(item.id)}
                onToggle={() => onToggle(item.id)}
                onDismiss={() => onDismiss(item.id)}
              />
            ))}
          </ul>

          {phase.monthlyRows.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <button
                onClick={() => setMonthsOpen(!monthsOpen)}
                style={{
                  background: "transparent",
                  border: `1px solid ${C.inkFaint}`,
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: C.inkSoft,
                  cursor: "pointer",
                }}
              >
                {monthsOpen ? "Hide" : "Show"} month-by-month ({phase.monthlyRows.length})
              </button>
              {monthsOpen && (
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {phase.monthlyRows.map((row) => (
                    <div
                      key={row.monthIndex}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "90px 1fr",
                        gap: 12,
                        padding: "8px 0",
                        borderTop: `1px dashed ${C.inkFaint}`,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          color: C.inkMute,
                          paddingTop: 4,
                        }}
                      >
                        {row.dateLabel}
                      </div>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                        {row.tasks.map((task) => (
                          <li
                            key={task.id}
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              fontSize: 13,
                              color: checked.has(task.id) ? C.inkMute : C.inkSoft,
                            }}
                          >
                            <button
                              onClick={() => onToggle(task.id)}
                              aria-label={checked.has(task.id) ? "Uncheck" : "Check"}
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: 3,
                                border: `1.5px solid ${checked.has(task.id) ? C.sage : C.inkFaint}`,
                                background: checked.has(task.id) ? C.sage : "transparent",
                                color: "#fff",
                                fontSize: 10,
                                cursor: "pointer",
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {checked.has(task.id) ? "✓" : ""}
                            </button>
                            <span
                              style={{
                                textDecoration: checked.has(task.id) ? "line-through" : "none",
                              }}
                            >
                              {task.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));

const fmtMonths = (m: number) => {
  if (!isFinite(m) || m < 0) return "—";
  if (m < 12) return `${m} mo`;
  const y = Math.floor(m / 12);
  const r = m % 12;
  return r === 0 ? `${y} yr` : `${y} yr ${r} mo`;
};
