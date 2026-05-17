import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getUpgradeFunnel } from "@/lib/upgrade-funnel.functions";

export const Route = createFileRoute("/admin/upgrade-funnel")({
  head: () => ({
    meta: [
      { title: "Upgrade funnel — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UpgradeFunnelPage,
});

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
};

function UpgradeFunnelPage() {
  const [days, setDays] = useState(30);
  const fetchFunnel = useServerFn(getUpgradeFunnel);
  const q = useQuery({
    queryKey: ["upgrade-funnel", days],
    queryFn: () => fetchFunnel({ data: { days } }),
    retry: false,
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.paper,
        color: C.ink,
        padding: "48px 24px",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 36,
            fontWeight: 400,
            margin: "0 0 6px",
          }}
        >
          Upgrade funnel
        </h1>
        <p style={{ color: C.inkMute, margin: "0 0 24px" }}>
          Clicks → checkout opens → paid signups, broken out by surface. Last-click
          attribution.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: `1px solid ${C.ink}`,
                background: days === d ? C.ink : "transparent",
                color: days === d ? C.paper : C.ink,
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {d}d
            </button>
          ))}
        </div>

        {q.isLoading && <p>Loading…</p>}
        {q.error && (
          <p style={{ color: C.ember }}>
            {(q.error as Error).message ||
              "Failed to load funnel. Make sure ADMIN_EMAILS is set and includes your account."}
          </p>
        )}
        {q.data && q.data.rows.length === 0 && (
          <p style={{ color: C.inkMute }}>No events in this range yet.</p>
        )}
        {q.data && q.data.rows.length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", borderBottom: `2px solid ${C.ink}` }}>
                <Th>Surface</Th>
                <Th>Tier</Th>
                <Th align="right">Clicks</Th>
                <Th align="right">Checkout opens</Th>
                <Th align="right">Signups</Th>
                <Th align="right">Click → paid</Th>
              </tr>
            </thead>
            <tbody>
              {q.data.rows.map((r, i) => (
                <tr key={`${r.source}-${r.tier}-${i}`} style={{ borderBottom: `1px solid ${C.inkFaint}` }}>
                  <Td>{r.source}</Td>
                  <Td>{r.tier}</Td>
                  <Td align="right">{r.clicks}</Td>
                  <Td align="right">{r.checkout_opens}</Td>
                  <Td align="right" bold>
                    {r.signups}
                  </Td>
                  <Td align="right">{r.click_to_paid_pct}%</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        padding: "10px 8px",
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        textAlign: align,
        color: C.inkMute,
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  bold,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  bold?: boolean;
}) {
  return (
    <td
      style={{
        padding: "10px 8px",
        textAlign: align,
        fontWeight: bold ? 600 : 400,
      }}
    >
      {children}
    </td>
  );
}
