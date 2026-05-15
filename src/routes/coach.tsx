import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { useAuthReady } from "@/hooks/useAuthReady";
import { getPaddleEnvironment } from "@/lib/paddle";
import {
  getCoachMessages,
  sendCoachMessage,
  clearCoachHistory,
  listCoachPlans,
} from "@/lib/coach.functions";

export const Route = createFileRoute("/coach")({
  head: () => ({
    meta: [
      { title: "Coach — Keystone" },
      { name: "description", content: "Your AI homebuying coach." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: CoachPage,
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

// Tight, brand-aligned markdown renderer. Avoids the default 1998 look.
function CoachMarkdown({ children, dark = false }: { children: string; dark?: boolean }) {
  const linkColor = C.ember;
  const codeBg = dark ? "rgba(255,255,255,0.10)" : "rgba(26,26,26,0.06)";
  return (
    <div style={{ fontSize: 16, lineHeight: 1.55 }}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p style={{ margin: "0 0 10px" }}>{children}</p>,
          ul: ({ children }) => (
            <ul style={{ margin: "4px 0 12px", paddingLeft: 22 }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: "4px 0 12px", paddingLeft: 22 }}>{children}</ol>
          ),
          li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              style={{ color: linkColor, textDecoration: "underline" }}
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong style={{ fontWeight: 600 }}>{children}</strong>
          ),
          code: ({ children }) => (
            <code
              style={{
                fontFamily: mono,
                fontSize: "0.88em",
                background: codeBg,
                padding: "1px 5px",
                borderRadius: 4,
              }}
            >
              {children}
            </code>
          ),
          h1: ({ children }) => (
            <h3 style={{ fontSize: 19, margin: "8px 0 8px", fontWeight: 600 }}>{children}</h3>
          ),
          h2: ({ children }) => (
            <h4 style={{ fontSize: 17, margin: "8px 0 6px", fontWeight: 600 }}>{children}</h4>
          ),
          h3: ({ children }) => (
            <h5 style={{ fontSize: 16, margin: "6px 0 4px", fontWeight: 600 }}>{children}</h5>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

type CoachMsg = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  meta?: { chips?: string[]; plan_id?: string } | null;
};

function CoachPage() {
  const auth = useAuthReady();
  const sub = useSubscription();
  const gate = useUpgradeGate();
  const qc = useQueryClient();
  const fetchMsgs = useServerFn(getCoachMessages);
  const fetchPlans = useServerFn(listCoachPlans);
  const sendMsg = useServerFn(sendCoachMessage);
  const clearMsgs = useServerFn(clearCoachHistory);
  const [input, setInput] = useState("");
  const [planId, setPlanId] = useState<string | "">("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const proLocked = !sub.loading && !sub.isPro;

  const { data, isLoading } = useQuery({
    queryKey: ["coach-messages", auth.user?.id],
    queryFn: () => fetchMsgs(),
    enabled: auth.ready && !!auth.user && !proLocked,
  });

  const { data: plansData } = useQuery({
    queryKey: ["coach-plans", auth.user?.id],
    queryFn: () => fetchPlans(),
    enabled: auth.ready && !!auth.user && !proLocked,
  });
  const plans = plansData?.plans ?? [];

  const send = useMutation({
    mutationFn: async (content: string) => {
      return sendMsg({
        data: {
          content,
          environment: getPaddleEnvironment(),
          planId: planId || undefined,
        },
      });
    },
    onSuccess: () => {
      setInput("");
      qc.invalidateQueries({ queryKey: ["coach-messages"] });
    },
  });

  const clear = useMutation({
    mutationFn: () => clearMsgs(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-messages"] }),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages?.length, send.isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || send.isPending) return;
    send.mutate(text);
  };

  // Last assistant message — used to surface follow-up chips.
  const messages = (data?.messages ?? []) as CoachMsg[];
  const lastAssistantChips = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant") {
        return m.meta?.chips && Array.isArray(m.meta.chips) ? m.meta.chips : [];
      }
      if (m.role === "user") return [];
    }
    return [];
  }, [messages]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        color: C.ink,
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "20px 24px 14px",
          borderBottom: `1px solid ${C.ink}`,
          maxWidth: 720,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link
            to="/dashboard"
            style={{
              color: C.inkMute,
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            ← Dashboard
          </Link>
          <div
            style={{
              fontFamily: mono,
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: C.ember,
            }}
          >
            Coach
          </div>
          {!proLocked && messages.length > 0 ? (
            <button
              type="button"
              onClick={() => clear.mutate()}
              style={{
                background: "transparent",
                border: "none",
                color: C.inkMute,
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          ) : (
            <span style={{ width: 40 }} />
          )}
        </div>

        {!proLocked && plans.length > 1 ? (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: mono,
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: C.inkMute,
            }}
          >
            <span>About plan</span>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              style={{
                flex: 1,
                background: "#fff",
                border: `1px solid ${C.inkFaint}`,
                borderRadius: 6,
                padding: "6px 8px",
                fontFamily: mono,
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "none",
                color: C.ink,
              }}
            >
              <option value="">Most recent</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || "Untitled plan"}
                  {p.version && p.version > 1 ? ` · v${p.version}` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </header>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "28px 20px",
          maxWidth: 720,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {proLocked ? (
          <div style={{ padding: "40px 4px" }}>
            <div
              style={{
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: C.ember,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              Pro feature
            </div>
            <h1
              style={{
                fontSize: 36,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                margin: "0 0 12px",
                textAlign: "center",
              }}
            >
              Your personal homebuying coach
            </h1>
            <p
              style={{
                color: C.inkSoft,
                fontSize: 17,
                lineHeight: 1.5,
                maxWidth: 460,
                margin: "0 auto 24px",
                textAlign: "center",
              }}
            >
              Trained on your saved plan answers — invest-vs-save math, timeline,
              savings goal, and the lender questions you haven't asked yet.
            </p>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 auto 28px",
                maxWidth: 480,
                color: C.inkSoft,
                fontSize: 16,
                lineHeight: 1.5,
              }}
            >
              {[
                "Pressure-test your timeline against rates, savings rate, and target home price.",
                "Get a plan-specific shortlist of next steps for this month.",
                "Run what-ifs (\"What if I save $200 more/mo?\") in plain English.",
              ].map((t) => (
                <li key={t} style={{ display: "flex", gap: 12, padding: "8px 0" }}>
                  <span style={{ color: C.ember, fontFamily: mono, fontSize: 12, marginTop: 4 }}>
                    ◆
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <div
              style={{
                background: "#fff",
                border: `1px solid ${C.inkFaint}`,
                borderRadius: 12,
                padding: "16px 18px",
                maxWidth: 520,
                margin: "0 auto 24px",
              }}
            >
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 9,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: C.inkMute,
                  marginBottom: 8,
                }}
              >
                Sample
              </div>
              <p style={{ margin: "0 0 10px", color: C.ink, fontStyle: "italic" }}>
                "Is my 18-month timeline realistic at $1,200/mo?"
              </p>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: 15, lineHeight: 1.5 }}>
                You're $14k short at month 18 if you keep that in a savings account, but
                investing the same $1,200/mo at 7% closes the gap by month 16. Two levers
                from here: bump to $1,350/mo, or push the date by 2 months.
              </p>
            </div>

            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                onClick={() => gate.openUpgrade("pro", "AI homebuying coach")}
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
                  cursor: "pointer",
                }}
              >
                Upgrade to Pro →
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <p style={{ color: C.inkMute }}>Loading…</p>
        ) : messages.length === 0 ? (
          <div style={{ color: C.inkSoft, fontSize: 17, lineHeight: 1.5, padding: "20px 0" }}>
            <p>Hi — I'm your Keystone Coach. Ask me anything about your homebuying plan.</p>
            <p style={{ color: C.inkMute, fontSize: 14, marginTop: 16 }}>
              Try: "How can I improve my credit score before applying?" or "Is my timeline realistic?"
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: m.role === "user" ? C.ink : "#fff",
                  color: m.role === "user" ? C.paper : C.ink,
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: m.role === "user" ? "none" : `1px solid ${C.inkFaint}`,
                }}
              >
                <CoachMarkdown dark={m.role === "user"}>{m.content}</CoachMarkdown>
              </div>
            ))}
            {send.isPending && (
              <div style={{ alignSelf: "flex-start", color: C.inkMute, fontStyle: "italic", fontSize: 15 }}>
                Coach is thinking…
              </div>
            )}
            {send.isError && (
              <div style={{ color: C.ember, fontSize: 14 }}>
                Couldn't send that message. Your input is still there — try again.
              </div>
            )}
            {!send.isPending && lastAssistantChips.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
                {lastAssistantChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setInput(chip);
                      send.mutate(chip);
                    }}
                    style={{
                      background: "transparent",
                      border: `1px solid ${C.inkFaint}`,
                      borderRadius: 999,
                      padding: "8px 14px",
                      fontFamily: "inherit",
                      fontSize: 14,
                      color: C.inkSoft,
                      cursor: "pointer",
                      lineHeight: 1.2,
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!proLocked && (
        <form
          onSubmit={handleSubmit}
          style={{
            borderTop: `1px solid ${C.inkFaint}`,
            padding: "16px 20px",
            maxWidth: 720,
            width: "100%",
            margin: "0 auto",
            boxSizing: "border-box",
            display: "flex",
            gap: 10,
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach…"
            style={{
              flex: 1,
              padding: "12px 14px",
              border: `1.5px solid ${C.ink}`,
              borderRadius: 8,
              fontSize: 16,
              fontFamily: "inherit",
              background: "#fff",
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || send.isPending}
            style={{
              background: C.ink,
              color: C.paper,
              padding: "0 20px",
              border: "none",
              borderRadius: 8,
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: input.trim() && !send.isPending ? "pointer" : "default",
              opacity: input.trim() && !send.isPending ? 1 : 0.5,
            }}
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
