import { RECOMMENDED_ACCOUNTS } from "@/data/recommended-accounts";
import { InvestSection } from "./InvestVsSavePanel";

const C = {
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  paper: "#f5efe6",
  sage: "#5a8a5c",
};

export function RecommendedAccountsPanel({
  locked,
  onLockedClick,
  timelineYears,
}: {
  locked: boolean;
  onLockedClick: () => void;
  timelineYears: number;
}) {
  const hasAccounts = RECOMMENDED_ACCOUNTS.length > 0;
  const matched = hasAccounts
    ? RECOMMENDED_ACCOUNTS.filter(
        (a) => timelineYears >= a.bestForTimelineYears[0] && timelineYears <= a.bestForTimelineYears[1],
      )
    : [];

  return (
    <InvestSection
      eyebrow="— Where to put your money"
      title="Recommended accounts."
      locked={locked}
      onLockedClick={onLockedClick}
      lockedCta="Unlock with Plus"
      requiredTier="plus"
    >
      {!hasAccounts ? (
        <div>
          <p style={{ color: C.inkSoft, fontSize: 16, lineHeight: 1.5, margin: "0 0 16px" }}>
            We're putting together a hand-picked list of HYSAs, brokerages, and robo-advisors matched to your
            timeline. As a Plus member, you'll see them here as soon as they're ready.
          </p>
          <div
            style={{
              padding: "14px 16px",
              border: `1px dashed ${C.inkFaint}`,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: C.inkMute,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.04em",
            }}
          >
            <span style={{ fontSize: 18 }}>⏳</span>
            Curated recommendations — coming in the next few weeks.
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: C.inkMute, lineHeight: 1.5 }}>
            We're vetting partners on three things: <strong style={{ color: C.ink }}>fees</strong>,{" "}
            <strong style={{ color: C.ink }}>ease of opening</strong>, and{" "}
            <strong style={{ color: C.ink }}>fit for short-to-medium timelines</strong>. No pay-to-play picks.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {(matched.length ? matched : RECOMMENDED_ACCOUNTS).map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                border: `1px solid ${C.inkFaint}`,
                borderRadius: 8,
                padding: "12px 14px",
                textDecoration: "none",
                color: C.ink,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <strong style={{ fontSize: 16 }}>{a.name}</strong>
                <span style={{ fontSize: 13, color: C.ember, fontVariantNumeric: "tabular-nums" }}>{a.apyOrReturn}</span>
              </div>
              <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>{a.blurb}</div>
            </a>
          ))}
        </div>
      )}
    </InvestSection>
  );
}
