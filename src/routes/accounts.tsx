import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { ACCOUNT_CATEGORIES } from "@/lib/recommended-accounts";

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "Recommended accounts — Keystone" },
      { name: "description", content: "Curated savings & investment accounts to grow your down payment faster." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: AccountsPage,
});

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
};

const mono = "'JetBrains Mono', monospace";

function AccountsPage() {
  const sub = useSubscription();
  const gate = useUpgradeGate();
  const locked = !sub.loading && !sub.isPlus;

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: "'Cormorant Garamond', Georgia, serif", padding: "28px 20px 80px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.ink}`, marginBottom: 32 }}>
          <Link to="/dashboard" style={{ color: C.inkMute, fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", textDecoration: "none" }}>
            ← Dashboard
          </Link>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ember }}>
            Recommended accounts · Plus
          </div>
        </div>

        <h1 style={{ fontWeight: 400, fontSize: 40, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
          Where to actually keep your down payment
        </h1>
        <p style={{ color: C.inkSoft, fontSize: 17, lineHeight: 1.5, marginBottom: 28 }}>
          Most first-time buyers leave their savings in a 0.01% checking account. Here's what to do instead — by horizon.
        </p>

        {locked ? (
          <LockedCard onUpgrade={() => gate.openUpgrade("plus", "Recommended accounts")} />
        ) : (
          <>
            <DisclaimerBanner />
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
              {ACCOUNT_CATEGORIES.map((cat) => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
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
        Plus feature
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 400, margin: "0 0 12px" }}>Stop leaving 4% on the table</h2>
      <p style={{ color: C.inkSoft, marginBottom: 18 }}>
        A curated list of HYSAs, treasuries, IRAs and brokerages — picked for the 1–5 year homebuying horizon.
      </p>
      <button
        type="button"
        onClick={onUpgrade}
        style={{ background: C.ink, color: C.paper, padding: "14px 22px", border: "none", borderRadius: 8, fontFamily: mono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}
      >
        Upgrade to Plus →
      </button>
    </div>
  );
}

function DisclaimerBanner() {
  return (
    <div style={{ background: "#fff7e8", border: `1px solid ${C.inkFaint}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, color: C.inkSoft, lineHeight: 1.5 }}>
      <strong style={{ color: C.ink }}>Heads up:</strong> partner links are coming soon. For now these are
      hand-picked recommendations only — not affiliate placements. We'll mark links clearly when that changes.
      Nothing here is investment advice; do your own research before opening any account.
    </div>
  );
}

function CategoryCard({ category }: { category: { id: string; title: string; why: string; goodFor: string; providers: { name: string; blurb: string; affiliateUrl: string | null }[] } }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.inkFaint}`, borderRadius: 12, padding: 22 }}>
      <h3 style={{ fontWeight: 500, fontSize: 22, margin: "0 0 8px" }}>{category.title}</h3>
      <p style={{ color: C.inkSoft, fontSize: 15, lineHeight: 1.5, margin: "0 0 6px" }}>{category.why}</p>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: C.ember, margin: "0 0 14px" }}>
        Good for: <span style={{ color: C.inkMute, letterSpacing: "0.08em", textTransform: "none", fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 14 }}>{category.goodFor}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {category.providers.map((p) => (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 12px", border: `1px solid ${C.inkFaint}`, borderRadius: 8, background: C.paper }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 16 }}>{p.name}</div>
              <div style={{ color: C.inkMute, fontSize: 13 }}>{p.blurb}</div>
            </div>
            <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.inkMute, padding: "4px 10px", border: `1px solid ${C.inkFaint}`, borderRadius: 999 }}>
              Coming soon
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
