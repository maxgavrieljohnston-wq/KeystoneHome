import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { InvestSection } from "./InvestVsSavePanel";
import { updatePlanMeta } from "@/lib/plans.functions";
import { computePlanMetrics } from "@/lib/plan-metrics";
import { HOME_STYLES, getPriceByZip } from "@/lib/keystone";

const C = {
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  sage: "#5a8a5c",
};

type Priority = "nice" | "must";
type PriorityMap = Record<string, Priority>;

const LIFESTYLE_ITEMS = [
  { val: "kids", label: "Space for kids" },
  { val: "dog", label: "Room for a dog" },
  { val: "host", label: "Hosting friends" },
  { val: "mornings", label: "Quiet mornings outside" },
  { val: "garden", label: "Gardening" },
  { val: "lowmaint", label: "Low maintenance" },
  { val: "office", label: "Home office" },
];

const NEIGHBORHOOD_ITEMS = [
  { val: "walk", label: "Walkable area" },
  { val: "schools", label: "Good schools" },
  { val: "commute", label: "Near work" },
  { val: "transit", label: "Public transit" },
  { val: "quiet", label: "Quiet suburb" },
  { val: "nature", label: "Parks & nature" },
  { val: "nightlife", label: "Restaurants & nightlife" },
  { val: "family", label: "Near family" },
];

const LAYOUT_STYLES = new Set(["starter", "single", "multi", "fixer"]);

const num = (a: Record<string, unknown>, k: string, fb = 0): number => {
  const v = a[k];
  return typeof v === "number" && isFinite(v) ? v : fb;
};
const str = (a: Record<string, unknown>, k: string): string => {
  const v = a[k];
  return typeof v === "string" ? v : "";
};
const prioMap = (a: Record<string, unknown>, k: string): PriorityMap => {
  const v = a[k];
  if (!v || typeof v !== "object") return {};
  const out: PriorityMap = {};
  for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
    if (val === "nice" || val === "must") out[key] = val;
  }
  return out;
};

export function PicturePlacePanel({
  planId,
  answers,
  assumptions,
  locked,
  onLockedClick,
}: {
  planId: string;
  answers: Record<string, unknown>;
  assumptions: Record<string, number> | null;
  locked: boolean;
  onLockedClick: () => void;
}) {
  const qc = useQueryClient();
  const updateMeta = useServerFn(updatePlanMeta);

  const [zip, setZip] = useState(str(answers, "zip"));
  const [homeStyle, setHomeStyle] = useState(str(answers, "homeStyle"));
  const [homeLayout, setHomeLayout] = useState(str(answers, "homeLayout") || "any");
  const [beds, setBeds] = useState(num(answers, "beds", 2));
  const [baths, setBaths] = useState(num(answers, "baths", 2));
  const [outdoor, setOutdoor] = useState(str(answers, "outdoorSpace") || "none");
  const [parking, setParking] = useState(str(answers, "parking") || "street");
  const [lifestyle, setLifestyle] = useState<PriorityMap>(prioMap(answers, "lifestyle"));
  const [neighborhood, setNeighborhood] = useState<PriorityMap>(prioMap(answers, "neighborhood"));

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Reset when the active plan changes
  useEffect(() => {
    setZip(str(answers, "zip"));
    setHomeStyle(str(answers, "homeStyle"));
    setHomeLayout(str(answers, "homeLayout") || "any");
    setBeds(num(answers, "beds", 2));
    setBaths(num(answers, "baths", 2));
    setOutdoor(str(answers, "outdoorSpace") || "none");
    setParking(str(answers, "parking") || "street");
    setLifestyle(prioMap(answers, "lifestyle"));
    setNeighborhood(prioMap(answers, "neighborhood"));
  }, [planId]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveAnswers = useMemo<Record<string, unknown>>(() => {
    const next = { ...answers };
    next.zip = zip;
    if (zip.length >= 3) next.zipData = getPriceByZip(zip);
    next.homeStyle = homeStyle || null;
    next.homeLayout = homeLayout === "any" ? null : homeLayout;
    next.beds = beds;
    next.baths = baths;
    next.outdoorSpace = outdoor === "none" ? null : outdoor;
    next.parking = parking === "street" ? null : parking;
    next.lifestyle = lifestyle;
    next.neighborhood = neighborhood;
    // Clear any manual override so the live preview reflects the new features
    next.targetPriceOverride = undefined;
    return next;
  }, [answers, zip, homeStyle, homeLayout, beds, baths, outdoor, parking, lifestyle, neighborhood]);

  const liveMetrics = useMemo(
    () => computePlanMetrics(liveAnswers, assumptions),
    [liveAnswers, assumptions],
  );

  const mut = useMutation({
    mutationFn: () =>
      updateMeta({
        data: {
          planId,
          answersPatch: {
            zip,
            homeStyle: homeStyle || null,
            homeLayout: homeLayout === "any" ? null : homeLayout,
            beds,
            baths,
            outdoorSpace: outdoor === "none" ? null : outdoor,
            parking: parking === "street" ? null : parking,
            lifestyle,
            neighborhood,
            // Clearing the manual override so this panel's preview matches the DB
            targetPriceOverride: null,
          },
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

  const handleSave = () => {
    if (locked) return;
    mut.mutate();
  };

  const showLayout = LAYOUT_STYLES.has(homeStyle);

  return (
    <InvestSection
      eyebrow="— Picture your place"
      title="Tweak the home, watch the price."
      locked={locked}
      onLockedClick={onLockedClick}
      lockedCta="Unlock with Plus"
      requiredTier="plus"
    >
      {/* Live preview header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "14px 16px",
          background: "#faf6ee",
          border: `1px solid ${C.inkFaint}`,
          borderRadius: 8,
          marginBottom: 18,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: C.inkMute,
              marginBottom: 4,
            }}
          >
            Target price in {liveMetrics.city || "your area"}
          </div>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 32,
              lineHeight: 1,
              color: C.ink,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${liveMetrics.targetPrice.toLocaleString()}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>
          <div>{Math.round(liveMetrics.downPct * 10) / 10}% down · ${liveMetrics.downPayment.toLocaleString()}</div>
          <div>Est. monthly: ${Math.round(liveMetrics.totalHousing).toLocaleString()}</div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginTop: 4,
              color:
                status === "error" ? C.ember
                : status === "saving" ? C.inkMute
                : status === "saved" ? C.sage
                : C.inkFaint,
            }}
          >
            {status === "saving" ? "Saving…"
              : status === "saved" ? "✓ Saved"
              : status === "error" ? "Save failed"
              : "Click Save to update"}
          </div>
        </div>
      </div>

      {/* Location & basics */}
      <Field label="ZIP code">
        <input
          type="text"
          inputMode="numeric"
          value={zip}
          maxLength={5}
          onChange={(e) => setZip(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
          placeholder="e.g. 60607"
          style={inputStyle}
        />
      </Field>

      <Field label="Home style">
        <Pills
          options={[{ val: "", label: "Any" }, ...HOME_STYLES.map((s) => ({ val: s.id, label: s.label }))]}
          value={homeStyle}
          onSelect={setHomeStyle}
        />
      </Field>

      {showLayout && (
        <Field label="Layout">
          <Pills
            options={[
              { val: "any", label: "No preference" },
              { val: "ranch", label: "Ranch / single-story" },
              { val: "twostory", label: "Two-story" },
              { val: "split", label: "Split-level" },
            ]}
            value={homeLayout}
            onSelect={setHomeLayout}
          />
        </Field>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Bedrooms">
          <Stepper value={beds} onChange={setBeds} min={0} max={6} />
        </Field>
        <Field label="Bathrooms">
          <Stepper value={baths} onChange={setBaths} min={1} max={5} step={0.5} />
        </Field>
      </div>

      <Field label="Outdoor space">
        <Pills
          options={[
            { val: "none", label: "Not needed" },
            { val: "patio", label: "Patio / balcony" },
            { val: "yard", label: "Yard" },
          ]}
          value={outdoor}
          onSelect={setOutdoor}
        />
      </Field>

      <Field label="Parking">
        <Pills
          options={[
            { val: "street", label: "Street is fine" },
            { val: "driveway", label: "Driveway" },
            { val: "garage", label: "Garage" },
          ]}
          value={parking}
          onSelect={setParking}
        />
      </Field>

      <Field label="Lifestyle priorities">
        <PrioritySelect items={LIFESTYLE_ITEMS} values={lifestyle} onChange={setLifestyle} placeholder="Add a lifestyle priority…" />
      </Field>

      <Field label="Neighborhood priorities">
        <PrioritySelect items={NEIGHBORHOOD_ITEMS} values={neighborhood} onChange={setNeighborhood} placeholder="Add a neighborhood priority…" />
      </Field>

      <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={mut.isPending || locked}
          style={{
            padding: "10px 22px",
            background: C.ink,
            color: "#f5efe6",
            border: "none",
            borderRadius: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: mut.isPending ? "default" : "pointer",
            opacity: mut.isPending ? 0.6 : 1,
          }}
        >
          {mut.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </InvestSection>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${C.ink}`,
  outline: "none",
  fontSize: 18,
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  color: C.ink,
  padding: "4px 0 6px",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 18 }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: C.inkMute,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function Pills({
  options,
  value,
  onSelect,
}: {
  options: { val: string; label: string }[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const active = value === o.val;
        return (
          <button
            key={o.val}
            type="button"
            onClick={() => onSelect(o.val)}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              borderRadius: 999,
              border: `1px solid ${active ? C.ink : C.inkFaint}`,
              background: active ? C.ink : "transparent",
              color: active ? "#f5efe6" : C.ink,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const dec = () => onChange(Math.max(min, +(value - step).toFixed(1)));
  const inc = () => onChange(Math.min(max, +(value + step).toFixed(1)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button type="button" onClick={dec} style={stepBtn}>−</button>
      <span style={{ fontSize: 18, fontFamily: "'Cormorant Garamond', Georgia, serif", minWidth: 28, textAlign: "center" }}>
        {value}{value >= max ? "+" : ""}
      </span>
      <button type="button" onClick={inc} style={stepBtn}>+</button>
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  border: `1px solid ${C.ink}`,
  background: "transparent",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
  color: C.ink,
};

function PrioritySelect({
  items,
  values,
  onChange,
  placeholder,
}: {
  items: { val: string; label: string }[];
  values: PriorityMap;
  onChange: (v: PriorityMap) => void;
  placeholder: string;
}) {
  const available = items.filter((it) => !(it.val in values));
  const selected = items.filter((it) => it.val in values);

  const add = (val: string) => {
    if (!val) return;
    onChange({ ...values, [val]: "nice" });
  };
  const toggle = (val: string) => {
    onChange({ ...values, [val]: values[val] === "must" ? "nice" : "must" });
  };
  const remove = (val: string) => {
    const next = { ...values };
    delete next[val];
    onChange(next);
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <select
        value=""
        onChange={(e) => add(e.target.value)}
        disabled={available.length === 0}
        style={{
          width: "100%",
          padding: "8px 10px",
          fontSize: 14,
          fontFamily: "inherit",
          color: C.ink,
          background: "transparent",
          border: `1px solid ${C.inkFaint}`,
          borderRadius: 6,
          cursor: available.length === 0 ? "default" : "pointer",
        }}
      >
        <option value="">{available.length === 0 ? "All added" : placeholder}</option>
        {available.map((it) => (
          <option key={it.val} value={it.val}>{it.label}</option>
        ))}
      </select>

      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {selected.map((it) => {
            const must = values[it.val] === "must";
            return (
              <span
                key={it.val}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 4px 4px 10px",
                  fontSize: 13,
                  borderRadius: 999,
                  border: `1px solid ${must ? C.ink : C.inkFaint}`,
                  background: must ? C.ink : "transparent",
                  color: must ? "#f5efe6" : C.ink,
                }}
              >
                {it.label}
                <button
                  type="button"
                  onClick={() => toggle(it.val)}
                  title={must ? "Must-have (click for nice)" : "Nice (click for must-have)"}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: 999,
                    border: `1px solid ${must ? "#f5efe6" : C.inkFaint}`,
                    background: "transparent",
                    color: must ? "#f5efe6" : C.inkSoft,
                    cursor: "pointer",
                  }}
                >
                  {must ? "Must" : "Nice"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(it.val)}
                  aria-label={`Remove ${it.label}`}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    border: "none",
                    background: "transparent",
                    color: must ? "#f5efe6" : C.inkMute,
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 10px",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        borderRadius: 999,
        border: `1px solid ${active ? C.ink : C.inkFaint}`,
        background: active ? C.ink : "transparent",
        color: active ? "#f5efe6" : C.inkSoft,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
