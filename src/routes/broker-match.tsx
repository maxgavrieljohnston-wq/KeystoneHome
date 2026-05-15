import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import {
  submitBrokerMatchRequest,
  getMyBrokerMatchRequests,
  cancelBrokerMatchRequest,
} from "@/lib/broker-match.functions";

export const Route = createFileRoute("/broker-match")({
  head: () => ({
    meta: [
      { title: "Broker & realtor matching — Keystone" },
      { name: "description", content: "Get matched with vetted mortgage brokers and realtors in your market." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: BrokerMatchPage,
});

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  good: "#2e6b3a",
};
const mono = "'JetBrains Mono', monospace";
const serif = "'Cormorant Garamond', Georgia, serif";

type ServiceType = "mortgage" | "realtor" | "both";

function BrokerMatchPage() {
  const sub = useSubscription();
  const gate = useUpgradeGate();
  const qc = useQueryClient();
  const fetchRequests = useServerFn(getMyBrokerMatchRequests);
  const submitFn = useServerFn(submitBrokerMatchRequest);
  const cancelFn = useServerFn(cancelBrokerMatchRequest);

  const locked = !sub.loading && !sub.isPlus && !sub.isPro;
  const isPro = sub.isPro;

  const requestsQuery = useQuery({
    queryKey: ["broker-match-requests"],
    queryFn: () => fetchRequests(),
    enabled: !locked,
  });

  const submitMut = useMutation({
    mutationFn: (input: Parameters<typeof submitBrokerMatchRequest>[0]["data"]) =>
      submitFn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broker-match-requests"] }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broker-match-requests"] }),
  });

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: serif, padding: "28px 20px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.ink}`, marginBottom: 32 }}>
          <Link to="/dashboard" style={{ color: C.inkMute, fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", textDecoration: "none" }}>
            ← Dashboard
          </Link>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ember }}>
            Match · {isPro ? "Pro priority" : "Plus & Pro"}
          </div>
        </div>

        <h1 style={{ fontWeight: 400, fontSize: 40, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
          Get matched with the right pros
        </h1>
        <p style={{ color: C.inkSoft, fontSize: 17, lineHeight: 1.5, marginBottom: 28 }}>
          Tell us what you need — a <strong>mortgage broker</strong>, a <strong>realtor</strong>, or both — and we'll
          intro you to vetted local pros.{" "}
          {isPro ? <span style={{ color: C.ember }}>Pro members get matched within 48 hours.</span> : "Plus members are added to the standard queue."}
        </p>

        {locked ? (
          <LockedCard onUpgrade={() => gate.openUpgrade("plus", "Broker & realtor matching")} />
        ) : (
          <>
            <RequestForm
              onSubmit={(input) => submitMut.mutateAsync(input)}
              submitting={submitMut.isPending}
              error={submitMut.error?.message ?? null}
              success={submitMut.isSuccess}
            />
            <ExistingRequests
              loading={requestsQuery.isLoading}
              requests={requestsQuery.data?.requests ?? []}
              onCancel={(id) => cancelMut.mutate(id)}
              cancelling={cancelMut.isPending}
            />
          </>
        )}
      </div>
    </div>
  );
}

function LockedCard({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div style={{ border: `1.5px solid ${C.ink}`, borderRadius: 12, padding: 28, textAlign: "center" }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ember, marginBottom: 8 }}>
        Plus or Pro feature
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 12px" }}>Skip the cold outreach</h2>
      <p style={{ color: C.inkSoft, marginBottom: 18 }}>
        Get warm intros to vetted mortgage brokers and realtors who actually work with first-time buyers.
      </p>
      <button
        type="button"
        onClick={onUpgrade}
        style={{ background: C.ink, color: C.paper, padding: "14px 22px", border: "none", borderRadius: 8, fontFamily: mono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}
      >
        Upgrade →
      </button>
    </div>
  );
}

function RequestForm({
  onSubmit,
  submitting,
  error,
  success,
}: {
  onSubmit: (input: {
    serviceType: ServiceType;
    targetCity?: string;
    targetState?: string;
    targetZip?: string;
    priceMin?: number | null;
    priceMax?: number | null;
    timeline?: "0-3m" | "3-6m" | "6-12m" | "12m+";
    loanType?: "conventional" | "fha" | "va" | "usda" | "jumbo" | "unsure";
    creditBand?: "740+" | "700-739" | "660-699" | "620-659" | "<620" | "unsure";
    firstTimeBuyer?: boolean;
    buyerOrSeller?: "buyer" | "seller" | "both";
    propertyType?: "single-family" | "condo" | "townhome" | "multi-family" | "other";
    preferredLanguage?: string;
    contactMethod?: "email" | "phone" | "text";
    contactTime?: string;
    notes?: string;
  }) => Promise<unknown>;
  submitting: boolean;
  error: string | null;
  success: boolean;
}) {
  const [serviceType, setServiceType] = useState<ServiceType>("both");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [timeline, setTimeline] = useState<"0-3m" | "3-6m" | "6-12m" | "12m+" | "">("");
  const [loanType, setLoanType] = useState<"conventional" | "fha" | "va" | "usda" | "jumbo" | "unsure" | "">("");
  const [creditBand, setCreditBand] = useState<"740+" | "700-739" | "660-699" | "620-659" | "<620" | "unsure" | "">("");
  const [firstTime, setFirstTime] = useState(true);
  const [buyerSeller, setBuyerSeller] = useState<"buyer" | "seller" | "both" | "">("buyer");
  const [propertyType, setPropertyType] = useState<"single-family" | "condo" | "townhome" | "multi-family" | "other" | "">("");
  const [language, setLanguage] = useState("");
  const [contactMethod, setContactMethod] = useState<"email" | "phone" | "text" | "">("email");
  const [contactTime, setContactTime] = useState("");
  const [notes, setNotes] = useState("");

  const wantsMortgage = serviceType === "mortgage" || serviceType === "both";
  const wantsRealtor = serviceType === "realtor" || serviceType === "both";

  const valid = useMemo(() => {
    if (!serviceType) return false;
    if (priceMin && priceMax && Number(priceMin) > Number(priceMax)) return false;
    return true;
  }, [serviceType, priceMin, priceMax]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    await onSubmit({
      serviceType,
      targetCity: city.trim() || undefined,
      targetState: state.trim() || undefined,
      targetZip: zip.trim() || undefined,
      priceMin: priceMin ? Number(priceMin) : null,
      priceMax: priceMax ? Number(priceMax) : null,
      timeline: timeline || undefined,
      loanType: wantsMortgage && loanType ? loanType : undefined,
      creditBand: wantsMortgage && creditBand ? creditBand : undefined,
      firstTimeBuyer: wantsMortgage ? firstTime : undefined,
      buyerOrSeller: wantsRealtor && buyerSeller ? buyerSeller : undefined,
      propertyType: wantsRealtor && propertyType ? propertyType : undefined,
      preferredLanguage: language.trim() || undefined,
      contactMethod: contactMethod || undefined,
      contactTime: contactTime.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ background: "#fff", border: `1px solid ${C.inkFaint}`, borderRadius: 12, padding: 22, display: "flex", flexDirection: "column", gap: 18 }}
    >
      <Field label="What do you need?">
        <SegmentedGroup
          value={serviceType}
          onChange={(v) => setServiceType(v as ServiceType)}
          options={[
            { value: "mortgage", label: "Mortgage broker" },
            { value: "realtor", label: "Realtor" },
            { value: "both", label: "Both" },
          ]}
        />
      </Field>

      <Row>
        <Field label="City" flex={2}>
          <Input value={city} onChange={setCity} placeholder="Austin" maxLength={120} />
        </Field>
        <Field label="State" flex={1}>
          <Input value={state} onChange={(v) => setState(v.toUpperCase().slice(0, 2))} placeholder="TX" maxLength={2} />
        </Field>
        <Field label="ZIP" flex={1}>
          <Input value={zip} onChange={setZip} placeholder="78704" maxLength={10} />
        </Field>
      </Row>

      <Row>
        <Field label="Price min ($)" flex={1}>
          <Input value={priceMin} onChange={setPriceMin} placeholder="350000" inputMode="numeric" />
        </Field>
        <Field label="Price max ($)" flex={1}>
          <Input value={priceMax} onChange={setPriceMax} placeholder="500000" inputMode="numeric" />
        </Field>
      </Row>

      <Field label="Timeline">
        <SegmentedGroup
          value={timeline}
          onChange={(v) => setTimeline(v as typeof timeline)}
          options={[
            { value: "0-3m", label: "0–3 mo" },
            { value: "3-6m", label: "3–6 mo" },
            { value: "6-12m", label: "6–12 mo" },
            { value: "12m+", label: "12 mo+" },
          ]}
        />
      </Field>

      {wantsMortgage && (
        <div style={{ borderTop: `1px solid ${C.inkFaint}`, paddingTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <SectionLabel>Mortgage broker details</SectionLabel>
          <Field label="Loan type">
            <Select
              value={loanType}
              onChange={(v) => setLoanType(v as typeof loanType)}
              options={[
                { value: "", label: "Select…" },
                { value: "conventional", label: "Conventional" },
                { value: "fha", label: "FHA" },
                { value: "va", label: "VA" },
                { value: "usda", label: "USDA" },
                { value: "jumbo", label: "Jumbo" },
                { value: "unsure", label: "Not sure yet" },
              ]}
            />
          </Field>
          <Field label="Credit score range">
            <Select
              value={creditBand}
              onChange={(v) => setCreditBand(v as typeof creditBand)}
              options={[
                { value: "", label: "Select…" },
                { value: "740+", label: "740 or higher" },
                { value: "700-739", label: "700–739" },
                { value: "660-699", label: "660–699" },
                { value: "620-659", label: "620–659" },
                { value: "<620", label: "Below 620" },
                { value: "unsure", label: "Not sure" },
              ]}
            />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: C.inkSoft }}>
            <input type="checkbox" checked={firstTime} onChange={(e) => setFirstTime(e.target.checked)} />
            First-time homebuyer
          </label>
        </div>
      )}

      {wantsRealtor && (
        <div style={{ borderTop: `1px solid ${C.inkFaint}`, paddingTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <SectionLabel>Realtor details</SectionLabel>
          <Field label="I'm looking to">
            <SegmentedGroup
              value={buyerSeller}
              onChange={(v) => setBuyerSeller(v as typeof buyerSeller)}
              options={[
                { value: "buyer", label: "Buy" },
                { value: "seller", label: "Sell" },
                { value: "both", label: "Both" },
              ]}
            />
          </Field>
          <Field label="Property type">
            <Select
              value={propertyType}
              onChange={(v) => setPropertyType(v as typeof propertyType)}
              options={[
                { value: "", label: "No preference" },
                { value: "single-family", label: "Single-family home" },
                { value: "condo", label: "Condo" },
                { value: "townhome", label: "Townhome" },
                { value: "multi-family", label: "Multi-family" },
                { value: "other", label: "Other" },
              ]}
            />
          </Field>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${C.inkFaint}`, paddingTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <SectionLabel>How should we reach you?</SectionLabel>
        <Row>
          <Field label="Contact method" flex={1}>
            <Select
              value={contactMethod}
              onChange={(v) => setContactMethod(v as typeof contactMethod)}
              options={[
                { value: "email", label: "Email" },
                { value: "phone", label: "Phone call" },
                { value: "text", label: "Text" },
              ]}
            />
          </Field>
          <Field label="Best time" flex={1}>
            <Input value={contactTime} onChange={setContactTime} placeholder="Weekday evenings" maxLength={80} />
          </Field>
        </Row>
        <Field label="Preferred language (optional)">
          <Input value={language} onChange={setLanguage} placeholder="English, Spanish, …" maxLength={40} />
        </Field>
        <Field label="Anything else we should pass along?">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
            placeholder="Self-employed, VA-eligible, want a bilingual agent, etc."
            rows={3}
            style={textareaStyle}
          />
          <div style={{ fontSize: 11, color: C.inkMute, fontFamily: mono, textAlign: "right" }}>{notes.length}/1000</div>
        </Field>
      </div>

      {error && (
        <div style={{ background: "#fee", border: `1px solid ${C.ember}`, color: C.ember, padding: "10px 12px", borderRadius: 8, fontSize: 14 }}>
          {error}
        </div>
      )}
      {success && !error && (
        <div style={{ background: "#eef7ee", border: `1px solid ${C.good}`, color: C.good, padding: "10px 12px", borderRadius: 8, fontSize: 14 }}>
          Request received — we'll be in touch soon.
        </div>
      )}

      <button
        type="submit"
        disabled={!valid || submitting}
        style={{
          background: C.ink,
          color: C.paper,
          padding: "14px 22px",
          border: "none",
          borderRadius: 8,
          fontFamily: mono,
          fontSize: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: valid && !submitting ? "pointer" : "not-allowed",
          opacity: valid && !submitting ? 1 : 0.5,
        }}
      >
        {submitting ? "Sending…" : "Request match →"}
      </button>
    </form>
  );
}

function ExistingRequests({
  loading,
  requests,
  onCancel,
  cancelling,
}: {
  loading: boolean;
  requests: Array<Record<string, unknown>>;
  onCancel: (id: string) => void;
  cancelling: boolean;
}) {
  if (loading) {
    return <div style={{ marginTop: 28, color: C.inkMute, fontFamily: mono, fontSize: 12 }}>Loading your requests…</div>;
  }
  if (requests.length === 0) return null;

  return (
    <div style={{ marginTop: 36 }}>
      <h2 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 14px" }}>Your requests</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {requests.map((r) => {
          const id = String(r.id);
          const status = String(r.status ?? "pending");
          const serviceType = String(r.service_type ?? "");
          const city = (r.target_city as string | null) ?? "";
          const stateCode = (r.target_state as string | null) ?? "";
          const created = new Date(String(r.created_at)).toLocaleDateString();
          const priority = Boolean(r.priority);
          const open = status !== "cancelled" && status !== "closed";
          return (
            <div
              key={id}
              style={{ background: "#fff", border: `1px solid ${C.inkFaint}`, borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
            >
              <div>
                <div style={{ fontWeight: 500, fontSize: 16, textTransform: "capitalize" }}>
                  {serviceType === "both" ? "Mortgage broker + Realtor" : serviceType === "mortgage" ? "Mortgage broker" : "Realtor"}
                  {priority && (
                    <span style={{ marginLeft: 8, fontFamily: mono, fontSize: 9, letterSpacing: "0.16em", color: C.ember, textTransform: "uppercase" }}>
                      Priority
                    </span>
                  )}
                </div>
                <div style={{ color: C.inkMute, fontSize: 13 }}>
                  {[city, stateCode].filter(Boolean).join(", ") || "Location TBD"} · submitted {created}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 999, border: `1px solid ${C.inkFaint}`, color: status === "matched" || status === "introduced" ? C.good : C.inkMute }}>
                  {status}
                </span>
                {open && (
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() => onCancel(id)}
                    style={{ background: "transparent", border: "none", color: C.inkMute, fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", padding: 0 }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- atoms -----

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${C.inkFaint}`,
  borderRadius: 8,
  fontSize: 15,
  fontFamily: serif,
  background: "#fff",
  color: C.ink,
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 70,
};

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: number }) {
  return (
    <div style={{ flex: flex ?? undefined, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: C.inkMute }}>{label}</span>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ember }}>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  maxLength,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "decimal";
}) {
  return (
    <input
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} style={inputStyle}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function SegmentedGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div style={{ display: "flex", gap: 0, border: `1px solid ${C.inkFaint}`, borderRadius: 8, overflow: "hidden", flexWrap: "wrap" }}>
      {options.map((opt, i) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              minWidth: 90,
              padding: "10px 8px",
              background: active ? C.ink : "#fff",
              color: active ? C.paper : C.ink,
              border: "none",
              borderLeft: i === 0 ? "none" : `1px solid ${C.inkFaint}`,
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
