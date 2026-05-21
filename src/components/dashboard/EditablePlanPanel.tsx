import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  updatePlanMeta,
  exportPlanPdf,
  exportPlanCsv,
  togglePlanShare,
  renamePlan,
  deletePlan,
} from "@/lib/plans.functions";
import {
  computePlanMetrics,
  computeTimeToGoal,
  formatMonths,
} from "@/lib/plan-metrics";
import { getStripeEnvironment } from "@/lib/stripe";
import { HOME_STYLES, CREDIT_BUCKETS } from "@/lib/keystone";

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
  monthlySavings?: number;
  targetPriceOverride?: number | null;
  timelineYears?: number;
  downGoalPct?: number | null;
  income?: number;
  partnerIncome?: number;
  debt?: number;
  partnerDebt?: number;
  credit?: number | null;
  partnerCredit?: number | null;
  zip?: string;
  homeStyle?: string | null;
  beds?: number;
  baths?: number;
  hasPartner?: boolean;
};

type Snapshot = {
  targetPrice: number;
  currentSavings: number;
  monthlySavings: number;
  hadOverride: boolean;
  timelineYears: number;
  downGoalPct: number | null;
  income: number;
  partnerIncome: number;
  debt: number;
  partnerDebt: number;
  credit: number | null;
  partnerCredit: number | null;
  zip: string;
  homeStyle: string | null;
  beds: number;
  baths: number;
  hasPartner: boolean;
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
const str = (a: Record<string, unknown>, k: string): string => {
  const v = a[k];
  return typeof v === "string" ? v : "";
};
const bool = (a: Record<string, unknown>, k: string): boolean => a[k] === true;
const nNum = (a: Record<string, unknown>, k: string): number | null => {
  const v = a[k];
  return typeof v === "number" && isFinite(v) ? v : null;
};

export function EditablePlanPanel({
  planId,
  planTitle,
  shareSlug,
  shareEnabled,
  answers,
  assumptions,
  currentSavings,
}: Props) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updatePlanMeta);
  const pdfFn = useServerFn(exportPlanPdf);
  const csvFn = useServerFn(exportPlanCsv);
  const shareFn = useServerFn(togglePlanShare);
  const renameFn = useServerFn(renamePlan);
  const deleteFn = useServerFn(deletePlan);
  const env = getStripeEnvironment();

  // Snapshot of original values, captured once on first mount.
  const snapshotRef = useRef<Snapshot | null>(null);
  if (snapshotRef.current === null) {
    const metrics = computePlanMetrics(answers, assumptions);
    const overrideRaw = answers.targetPriceOverride;
    const hadOverride =
      typeof overrideRaw === "number" && isFinite(overrideRaw) && overrideRaw > 0;
    snapshotRef.current = {
      targetPrice: hadOverride ? (overrideRaw as number) : metrics.targetPrice,
      currentSavings: currentSavings ?? 0,
      monthlySavings: num(answers, "monthlySavings"),
      hadOverride,
      timelineYears: num(answers, "timelineYears", 3),
      downGoalPct: nNum(answers, "downGoalPct"),
      income: num(answers, "income"),
      partnerIncome: num(answers, "partnerIncome"),
      debt: num(answers, "debt"),
      partnerDebt: num(answers, "partnerDebt"),
      credit: nNum(answers, "credit"),
      partnerCredit: nNum(answers, "partnerCredit"),
      zip: str(answers, "zip"),
      homeStyle: (answers.homeStyle as string | null) ?? null,
      beds: num(answers, "beds", 2),
      baths: num(answers, "baths", 2),
      hasPartner: bool(answers, "hasPartner"),
    };
  }
  const snap = snapshotRef.current;

  // Local state — strings for currency, raw values for selects/numbers.
  const initialTarget = (() => {
    const ov = answers.targetPriceOverride;
    if (typeof ov === "number" && ov > 0) return ov;
    return computePlanMetrics(answers, assumptions).targetPrice;
  })();

  const [target, setTarget] = useState(fmtMoney(initialTarget));
  const [savings, setSavings] = useState(fmtMoney(currentSavings ?? 0));
  const [monthly, setMonthly] = useState(fmtMoney(num(answers, "monthlySavings")));
  const [income, setIncome] = useState(fmtMoney(num(answers, "income")));
  const [partnerIncome, setPartnerIncome] = useState(fmtMoney(num(answers, "partnerIncome")));
  const [debt, setDebt] = useState(fmtMoney(num(answers, "debt")));
  const [partnerDebt, setPartnerDebt] = useState(fmtMoney(num(answers, "partnerDebt")));
  const [zip, setZip] = useState(str(answers, "zip"));
  const [homeStyle, setHomeStyle] = useState((answers.homeStyle as string | null) ?? "");
  const [beds, setBeds] = useState(num(answers, "beds", 2));
  const [baths, setBaths] = useState(num(answers, "baths", 2));
  const [timelineYears, setTimelineYears] = useState(num(answers, "timelineYears", 3));
  const [downGoalPct, setDownGoalPct] = useState<string>(
    nNum(answers, "downGoalPct") != null ? String(nNum(answers, "downGoalPct")) : "",
  );
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
      target: Number(onlyDigits(target) || 0),
      savings: Number(onlyDigits(savings) || 0),
      monthly: Number(onlyDigits(monthly) || 0),
      income: Number(onlyDigits(income) || 0),
      partnerIncome: Number(onlyDigits(partnerIncome) || 0),
      debt: Number(onlyDigits(debt) || 0),
      partnerDebt: Number(onlyDigits(partnerDebt) || 0),
      downGoalPct: downGoalPct === "" ? null : Number(downGoalPct),
      credit: credit === "" ? null : Number(credit),
      partnerCredit: partnerCredit === "" ? null : Number(partnerCredit),
    }),
    [target, savings, monthly, income, partnerIncome, debt, partnerDebt, downGoalPct, credit, partnerCredit],
  );

  // Build the "live" answers for downstream calculations.
  const liveAnswers = useMemo<Record<string, unknown>>(() => {
    return {
      ...answers,
      targetPriceOverride: parsed.target > 0 ? parsed.target : undefined,
      monthlySavings: parsed.monthly,
      income: parsed.income,
      partnerIncome: parsed.partnerIncome,
      debt: parsed.debt,
      partnerDebt: parsed.partnerDebt,
      credit: parsed.credit,
      partnerCredit: parsed.partnerCredit,
      downGoalPct: parsed.downGoalPct,
      timelineYears,
      zip,
      homeStyle: homeStyle || null,
      beds,
      baths,
      hasPartner,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, timelineYears, zip, homeStyle, beds, baths, hasPartner]);

  const liveMetrics = useMemo(
    () => computePlanMetrics(liveAnswers, assumptions),
    [liveAnswers, assumptions],
  );

  const timeToGoal = useMemo(
    () =>
      computeTimeToGoal({
        cashToClose: liveMetrics.cashToClose,
        currentSavings: parsed.savings,
        monthlySavings: parsed.monthly,
        annualReturnRate: liveMetrics.expectedReturnRate,
      }),
    [liveMetrics.cashToClose, liveMetrics.expectedReturnRate, parsed.savings, parsed.monthly],
  );

  const mut = useMutation({
    mutationFn: (vars: { currentSavings: number; answersPatch: AnswersPatch }) =>
      updateFn({
        data: {
          planId,
          currentSavings: vars.currentSavings,
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

  // Debounced autosave whenever any input changes.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      const patch: AnswersPatch = {
        monthlySavings: parsed.monthly,
        targetPriceOverride: parsed.target > 0 ? parsed.target : null,
        income: parsed.income,
        partnerIncome: parsed.partnerIncome,
        debt: parsed.debt,
        partnerDebt: parsed.partnerDebt,
        credit: parsed.credit,
        partnerCredit: parsed.partnerCredit,
        downGoalPct: parsed.downGoalPct,
        timelineYears,
        zip,
        homeStyle: homeStyle || null,
        beds,
        baths,
        hasPartner,
      };
      mut.mutate({ currentSavings: parsed.savings, answersPatch: patch });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, timelineYears, zip, homeStyle, beds, baths, hasPartner]);

  const dirty =
    parsed.target !== snap.targetPrice ||
    parsed.savings !== snap.currentSavings ||
    parsed.monthly !== snap.monthlySavings ||
    parsed.income !== snap.income ||
    parsed.partnerIncome !== snap.partnerIncome ||
    parsed.debt !== snap.debt ||
    parsed.partnerDebt !== snap.partnerDebt ||
    parsed.credit !== snap.credit ||
    parsed.partnerCredit !== snap.partnerCredit ||
    parsed.downGoalPct !== snap.downGoalPct ||
    timelineYears !== snap.timelineYears ||
    zip !== snap.zip ||
    (homeStyle || null) !== snap.homeStyle ||
    beds !== snap.beds ||
    baths !== snap.baths ||
    hasPartner !== snap.hasPartner;

  const handleRevert = () => {
    setTarget(fmtMoney(snap.targetPrice));
    setSavings(fmtMoney(snap.currentSavings));
    setMonthly(fmtMoney(snap.monthlySavings));
    setIncome(fmtMoney(snap.income));
    setPartnerIncome(fmtMoney(snap.partnerIncome));
    setDebt(fmtMoney(snap.debt));
    setPartnerDebt(fmtMoney(snap.partnerDebt));
    setZip(snap.zip);
    setHomeStyle(snap.homeStyle ?? "");
    setBeds(snap.beds);
    setBaths(snap.baths);
    setTimelineYears(snap.timelineYears);
    setDownGoalPct(snap.downGoalPct != null ? String(snap.downGoalPct) : "");
    setCredit(snap.credit != null ? String(snap.credit) : "");
    setPartnerCredit(snap.partnerCredit != null ? String(snap.partnerCredit) : "");
    setHasPartner(snap.hasPartner);
    mut.mutate({
      currentSavings: snap.currentSavings,
      answersPatch: {
        targetPriceOverride: snap.hadOverride ? snap.targetPrice : null,
        monthlySavings: snap.monthlySavings,
        income: snap.income,
        partnerIncome: snap.partnerIncome,
        debt: snap.debt,
        partnerDebt: snap.partnerDebt,
        credit: snap.credit,
        partnerCredit: snap.partnerCredit,
        downGoalPct: snap.downGoalPct,
        timelineYears: snap.timelineYears,
        zip: snap.zip,
        homeStyle: snap.homeStyle,
        beds: snap.beds,
        baths: snap.baths,
        hasPartner: snap.hasPartner,
      },
    });
  };

  // ── Plan actions ──────────────────────────────────────────────────────
  const [busy, setBusy] = useState<null | "pdf" | "csv" | "share" | "rename" | "delete">(null);
  const [showShare, setShowShare] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(planTitle ?? "");

  const handlePdf = async () => {
    setBusy("pdf");
    try {
      const res = await pdfFn({ data: { planId, environment: env } });
      downloadBase64(res.base64, res.filename, "application/pdf");
    } catch (e) {
      console.error(e);
      alert("Couldn't export PDF.");
    } finally {
      setBusy(null);
    }
  };
  const handleCsv = async () => {
    setBusy("csv");
    try {
      const res = await csvFn({ data: { planId, environment: env } });
      const blob = new Blob([res.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Couldn't export CSV.");
    } finally {
      setBusy(null);
    }
  };
  const shareMut = useMutation({
    mutationFn: (enabled: boolean) =>
      shareFn({ data: { planId, enabled, environment: env } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-plans"] }),
  });
  const handleShare = () => {
    setShowShare(true);
    if (!shareEnabled) shareMut.mutate(true);
  };
  const renameMut = useMutation({
    mutationFn: (t: string) => renameFn({ data: { planId, title: t } }),
    onSuccess: () => {
      setRenaming(false);
      qc.invalidateQueries({ queryKey: ["my-plans"] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: () => deleteFn({ data: { planId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-plans"] }),
  });
  const shareUrl = shareSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${shareSlug}`
    : "";

  const fmt$ = (n: number) => `$${Math.round(n).toLocaleString()}`;

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
          marginBottom: 6,
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

      {/* Title */}
      <div style={{ marginTop: 4, marginBottom: 18, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {renaming ? (
          <input
            type="text"
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => titleDraft.trim() && renameMut.mutate(titleDraft.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && titleDraft.trim()) renameMut.mutate(titleDraft.trim());
              if (e.key === "Escape") { setRenaming(false); setTitleDraft(planTitle ?? ""); }
            }}
            style={{
              fontSize: 22,
              fontFamily: "inherit",
              border: `1px solid ${C.inkFaint}`,
              borderRadius: 6,
              padding: "4px 8px",
              flex: 1,
              minWidth: 0,
            }}
          />
        ) : (
          <h2 style={{ fontWeight: 400, fontSize: 22, lineHeight: 1.1, margin: 0 }}>
            {planTitle || "Your homebuying plan"}
          </h2>
        )}
        <button
          type="button"
          onClick={() => { setRenaming((r) => !r); setTitleDraft(planTitle ?? ""); }}
          style={mutedLinkBtn}
        >
          {renaming ? "Cancel" : "Rename"}
        </button>
      </div>

      {/* SECTION: Home target */}
      <Section title="Home target">
        <Grid>
          <MoneyField label="Target home price" value={target} onChange={setTarget} />
          <TextField label="ZIP" value={zip} onChange={(v) => setZip(v.replace(/[^\d]/g, "").slice(0, 5))} placeholder="e.g. 60607" />
          <SelectField
            label="Home style"
            value={homeStyle}
            onChange={setHomeStyle}
            options={[{ value: "", label: "Any" }, ...HOME_STYLES.map((s) => ({ value: s.id, label: s.label }))]}
          />
          <NumberField label="Bedrooms" value={beds} onChange={setBeds} min={0} max={20} />
          <NumberField label="Bathrooms" value={baths} onChange={setBaths} min={0} max={20} step={0.5} />
          <SelectField
            label="Down payment goal"
            value={downGoalPct}
            onChange={setDownGoalPct}
            options={[
              { value: "", label: "Auto" },
              { value: "3.5", label: "3.5%" },
              { value: "5", label: "5%" },
              { value: "10", label: "10%" },
              { value: "15", label: "15%" },
              { value: "20", label: "20%" },
              { value: "25", label: "25%" },
            ]}
          />
        </Grid>
      </Section>

      {/* SECTION: Your finances */}
      <Section title="Your finances">
        <Grid>
          <MoneyField label="Annual income" value={income} onChange={setIncome} />
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
          <MoneyField label="Current savings" value={savings} onChange={setSavings} />
          <MoneyField label="Monthly contribution" value={monthly} onChange={setMonthly} />
          <NumberField label="Timeline (years)" value={timelineYears} onChange={setTimelineYears} min={0} max={50} step={0.5} />
        </Grid>
      </Section>

      {/* SECTION: Partner (toggle) */}
      <Section title="Partner">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: C.inkSoft, marginBottom: hasPartner ? 14 : 0 }}>
          <input type="checkbox" checked={hasPartner} onChange={(e) => setHasPartner(e.target.checked)} />
          Buying with a partner
        </label>
        {hasPartner && (
          <Grid>
            <MoneyField label="Partner annual income" value={partnerIncome} onChange={setPartnerIncome} />
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

      {/* ── Bottom metric: time saved by investing ── */}
      <div
        style={{
          marginTop: 22,
          padding: "18px 20px",
          background: C.ink,
          color: C.paper,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#f0a890",
            marginBottom: 8,
          }}
        >
          Time saved by investing
        </div>
        {timeToGoal.timeSavedMonths == null ? (
          <>
            <div style={{ fontSize: 26, lineHeight: 1.1, marginBottom: 6 }}>—</div>
            <div style={{ fontSize: 13, color: "#d6cfc3" }}>
              Add a monthly contribution to see how much faster investing gets you there.
            </div>
          </>
        ) : timeToGoal.timeSavedMonths <= 0 ? (
          <>
            <div style={{ fontSize: 26, lineHeight: 1.1, marginBottom: 6 }}>You're already there.</div>
            <div style={{ fontSize: 13, color: "#d6cfc3" }}>
              Your current savings already cover cash-to-close ({fmt$(liveMetrics.cashToClose)}).
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                fontSize: 30,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                marginBottom: 8,
              }}
            >
              {formatMonths(timeToGoal.timeSavedMonths)} sooner
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.08em",
                color: "#d6cfc3",
                lineHeight: 1.6,
              }}
            >
              Saving alone: {formatMonths(timeToGoal.monthsSaveOnly)}
              {"  →  "}
              Investing @ {(liveMetrics.expectedReturnRate * 100).toFixed(1)}%: {formatMonths(timeToGoal.monthsInvested)}
            </div>
          </>
        )}
      </div>

      {/* Revert row */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, color: C.inkMute, lineHeight: 1.4 }}>
          Changes flow into your projections and any PDF/CSV you download.
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

      {/* Plan actions */}
      <div
        style={{
          marginTop: 18,
          paddingTop: 16,
          borderTop: `1px solid ${C.inkFaint}`,
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <ActionBtn onClick={handlePdf} disabled={busy === "pdf"}>
          {busy === "pdf" ? "…" : "Download PDF"}
        </ActionBtn>
        <ActionBtn onClick={handleCsv} disabled={busy === "csv"}>
          {busy === "csv" ? "…" : "Download CSV"}
        </ActionBtn>
        <ActionBtn onClick={handleShare}>
          {shareEnabled ? "Manage share" : "Share link"}
        </ActionBtn>
        <ActionBtn
          danger
          onClick={() => {
            if (confirm("Delete this plan? This cannot be undone.")) deleteMut.mutate();
          }}
        >
          Delete
        </ActionBtn>
      </div>

      {/* Share modal */}
      {showShare && (
        <div
          onClick={() => setShowShare(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(26,26,26,0.55)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              padding: 28,
              borderRadius: 12,
              maxWidth: 460,
              width: "100%",
              border: `1.5px solid ${C.ink}`,
            }}
          >
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
              Share this plan
            </div>
            <h3 style={{ fontWeight: 400, fontSize: 24, margin: "0 0 16px" }}>
              Read-only public link
            </h3>
            {shareMut.isPending ? (
              <p style={{ color: C.inkMute }}>Generating link…</p>
            ) : shareUrl ? (
              <>
                <input
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  style={{
                    width: "100%",
                    padding: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    border: `1px solid ${C.inkFaint}`,
                    borderRadius: 6,
                    background: C.paper,
                    color: C.ink,
                    marginBottom: 12,
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(shareUrl)}
                    style={{
                      padding: "10px 16px",
                      background: C.ink,
                      color: C.paper,
                      border: "none",
                      borderRadius: 6,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      shareMut.mutate(false);
                      setShowShare(false);
                    }}
                    style={{
                      padding: "10px 16px",
                      background: "transparent",
                      color: C.ember,
                      border: `1px solid ${C.ember}`,
                      borderRadius: 6,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    Revoke
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowShare(false)}
                    style={{
                      marginLeft: "auto",
                      padding: "10px 16px",
                      background: "transparent",
                      color: C.inkMute,
                      border: "none",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

const mutedLinkBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  color: C.inkMute,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

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

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <FieldShell label={label}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputBase}
      />
    </FieldShell>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <FieldShell label={label}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? 0 : Number(v));
        }}
        style={inputBase}
      />
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

function ActionBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: disabled ? "default" : "pointer",
        color: danger ? C.ember : C.ink,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function downloadBase64(base64: string, filename: string, mime: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
