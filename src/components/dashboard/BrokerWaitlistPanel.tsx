import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { joinBrokerWaitlist, getMyWaitlistStatus } from "@/lib/broker-waitlist.functions";
import { InvestSection } from "./InvestVsSavePanel";

const C = {
  ink: "#1a1a1a",
  paper: "#f5efe6",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  sage: "#5a8a5c",
};

export function BrokerWaitlistPanel({
  isPro,
  isPlus,
  locked,
  onLockedClick,
}: {
  isPro: boolean;
  isPlus: boolean;
  locked: boolean;
  onLockedClick: () => void;
}) {
  const fetchStatus = useServerFn(getMyWaitlistStatus);
  const join = useServerFn(joinBrokerWaitlist);
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");

  const { data: status } = useQuery({
    queryKey: ["broker-waitlist-status"],
    queryFn: () => fetchStatus(),
    enabled: !locked,
  });

  const joinM = useMutation({
    mutationFn: () => join({ data: { notes: notes.trim() || undefined } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broker-waitlist-status"] }),
  });

  const joined = status?.joined === true;

  return (
    <InvestSection
      eyebrow={isPro ? "— Priority access" : "— Broker waitlist"}
      title={isPro ? "Front of the line." : "Be first when brokers go live."}
      locked={locked}
      onLockedClick={onLockedClick}
      lockedCta={isPro ? "Unlock with Pro" : "Unlock with Plus"}
      requiredTier={isPro ? "pro" : "plus"}
    >
      <p style={{ color: C.inkSoft, fontSize: 16, lineHeight: 1.5, margin: "0 0 16px" }}>
        We're vetting investment brokers who can put your down-payment savings to work for you. When this is live,
        you'll be able to open and fund an account in a few clicks — without leaving Keystone.
        {isPro && (
          <>
            {" "}
            <strong style={{ color: C.ink }}>As a Pro member, you're guaranteed priority access.</strong>
          </>
        )}
      </p>

      {joined ? (
        <div
          style={{
            padding: "14px 16px",
            background: C.sage,
            color: "#fff",
            borderRadius: 8,
            fontSize: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>
            ✓ You're on the waitlist
            {status?.priority ? " — priority access" : ""}.
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.85 }}>
            {status?.tier ?? ""}
          </span>
        </div>
      ) : (
        <>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional: anything specific you want in a brokerage? (e.g. low fees, robo, ESG)"
            rows={2}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: `1px solid ${C.inkFaint}`,
              borderRadius: 8,
              fontFamily: "inherit",
              fontSize: 14,
              color: C.ink,
              background: "#fff",
              resize: "vertical",
              marginBottom: 12,
            }}
          />
          <button
            type="button"
            onClick={() => joinM.mutate()}
            disabled={joinM.isPending}
            style={{
              padding: "12px 22px",
              background: C.ink,
              color: C.paper,
              border: "none",
              borderRadius: 8,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: joinM.isPending ? "default" : "pointer",
              opacity: joinM.isPending ? 0.6 : 1,
            }}
          >
            {joinM.isPending
              ? "Joining…"
              : isPro
                ? "Claim priority access →"
                : "Join the waitlist →"}
          </button>
          {joinM.isError && (
            <div style={{ marginTop: 10, color: C.ember, fontSize: 13 }}>
              Couldn't join — please try again.
            </div>
          )}
        </>
      )}
    </InvestSection>
  );
}
