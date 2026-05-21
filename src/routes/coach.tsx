import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { useAuthReady } from "@/hooks/useAuthReady";
import { getStripeEnvironment } from "@/lib/stripe";
import {
  getCoachMessages,
  sendCoachMessage,
  clearCoachHistory,
  listCoachPlans,
  getCoachStarters,
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

// Optimistic message rendered before the server-saved row arrives.
type LocalMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: { chips?: string[]; plan_id?: string } | null;
  pending?: boolean;
};

function CoachPage() {
  const auth = useAuthReady();
  const sub = useSubscription();
  const gate = useUpgradeGate();
  const qc = useQueryClient();
  const fetchMsgs = useServerFn(getCoachMessages);
  const fetchPlans = useServerFn(listCoachPlans);
  const fetchStarters = useServerFn(getCoachStarters);
  const sendMsg = useServerFn(sendCoachMessage);
  const clearMsgs = useServerFn(clearCoachHistory);
  const [input, setInput] = useState("");
  const [planId, setPlanId] = useState<string | "">("");
  const [pending, setPending] = useState<LocalMsg[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
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
  const planTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of plans) map.set(p.id, p.title || "Untitled plan");
    return map;
  }, [plans]);

  const { data: startersData } = useQuery({
    queryKey: ["coach-starters", auth.user?.id, planId || "latest"],
    queryFn: () => fetchStarters({ data: { planId: planId || undefined } }),
    enabled: auth.ready && !!auth.user && !proLocked,
  });
  const starters = startersData?.starters ?? [];

  const clear = useMutation({
    mutationFn: () => clearMsgs(),
    onSuccess: () => {
      setPending([]);
      setStreamingText("");
      setStreamError(null);
      qc.invalidateQueries({ queryKey: ["coach-messages"] });
    },
  });

  const messages = (data?.messages ?? []) as CoachMsg[];
  // Combine server messages, optimistic pending user message, and the
  // currently-streaming assistant draft.
  const view: LocalMsg[] = useMemo(() => {
    const out: LocalMsg[] = messages.map((m) => ({
      id: m.id,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      meta: m.meta ?? null,
    }));
    out.push(...pending);
    if (isStreaming) {
      out.push({
        id: "__streaming__",
        role: "assistant",
        content: streamingText || " ",
        pending: true,
      });
    }
    return out;
  }, [messages, pending, streamingText, isStreaming]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [view.length, streamingText]);

  const send = async (content: string) => {
    if (!content.trim() || isStreaming) return;
    setStreamError(null);
    setInput("");
    const localId = `local-${Date.now()}`;
    const activePlanId = planId || undefined;
    setPending([
      {
        id: localId,
        role: "user",
        content,
        meta: activePlanId ? { plan_id: activePlanId } : null,
      },
    ]);
    setStreamingText("");
    setIsStreaming(true);
    try {
      const stream = await sendMsg({
        data: {
          content,
          environment: getStripeEnvironment(),
          planId: activePlanId,
        },
      });
      let acc = "";
      for await (const chunk of stream as AsyncIterable<
        | { type: "delta"; delta: string }
        | { type: "done"; chips: string[]; reply: string }
      >) {
        if (chunk.type === "delta") {
          acc += chunk.delta;
          setStreamingText(acc);
        }
      }
    } catch (e) {
      console.error("[coach] send failed", e);
      setStreamError("Couldn't send that message. Try again.");
      // Roll back optimistic + restore input so user doesn't lose their text.
      setPending([]);
      setInput(content);
    } finally {
      setIsStreaming(false);
      setStreamingText("");
      setPending([]);
      qc.invalidateQueries({ queryKey: ["coach-messages"] });
    }
  };

  const lastAssistantChips = useMemo(() => {
    if (isStreaming) return [];
    for (let i = view.length - 1; i >= 0; i--) {
      const m = view[i];
      if (m.role === "assistant") {
        return m.meta?.chips && Array.isArray(m.meta.chips) ? m.meta.chips : [];
      }
      if (m.role === "user") return [];
    }
    return [];
  }, [view, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input.trim());
  };

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
          padding: "20px 20px 14px",
          borderBottom: `1px solid ${C.ink}`,
          maxWidth: 720,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Link
            to="/dashboard"
            style={{
              color: C.inkMute,
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              textDecoration: "none",
              whiteSpace: "nowrap",
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
          {!proLocked && (messages.length > 0 || pending.length > 0) ? (
            <button
              type="button"
              onClick={() => clear.mutate()}
              aria-label="Clear conversation"
              title="Clear conversation"
              style={{
                background: "transparent",
                border: `1px solid ${C.inkFaint}`,
                color: C.inkMute,
                fontFamily: mono,
                fontSize: 14,
                lineHeight: 1,
                width: 28,
                height: 28,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
              }}
            >
              ×
            </button>
          ) : (
            <span style={{ width: 28 }} />
          )}
        </div>

        {!proLocked && plans.length > 1 ? (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              fontFamily: mono,
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: C.inkMute,
            }}
          >
            <span style={{ flexShrink: 0 }}>About plan</span>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              style={{
                flex: "1 1 200px",
                minWidth: 0,
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
        ) : view.length === 0 ? (
          <div style={{ color: C.inkSoft, fontSize: 17, lineHeight: 1.5, padding: "20px 0" }}>
            <p style={{ margin: "0 0 8px" }}>
              Hi — I'm your Keystone Coach. Ask me anything about your homebuying plan.
            </p>
            <p style={{ color: C.inkMute, fontSize: 13, margin: "16px 0 10px", fontFamily: mono, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              Try one of these
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(starters.length > 0
                ? starters
                : [
                    "Is my homebuying timeline realistic?",
                    "What if I invested my down payment instead?",
                    "What lender questions should I ask first?",
                  ]
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  style={{
                    textAlign: "left",
                    background: "#fff",
                    border: `1px solid ${C.inkFaint}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    fontFamily: "inherit",
                    fontSize: 16,
                    color: C.ink,
                    cursor: "pointer",
                    lineHeight: 1.4,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {view.map((m) => {
              const tagPlan =
                plans.length > 1 && m.role === "user" && m.meta?.plan_id
                  ? planTitleById.get(m.meta.plan_id)
                  : null;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: m.role === "user" ? "flex-end" : "flex-start",
                    gap: 4,
                  }}
                >
                  {tagPlan && (
                    <div
                      style={{
                        fontFamily: mono,
                        fontSize: 9,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: C.inkMute,
                      }}
                    >
                      About: {tagPlan}
                    </div>
                  )}
                  <div
                    style={{
                      background: m.role === "user" ? C.ink : "#fff",
                      color: m.role === "user" ? C.paper : C.ink,
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: m.role === "user" ? "none" : `1px solid ${C.inkFaint}`,
                    }}
                  >
                    <CoachMarkdown dark={m.role === "user"}>
                      {m.content}
                    </CoachMarkdown>
                  </div>
                </div>
              );
            })}
            {isStreaming && !streamingText && (
              <div
                style={{
                  alignSelf: "flex-start",
                  color: C.inkMute,
                  fontStyle: "italic",
                  fontSize: 15,
                }}
              >
                Coach is thinking…
              </div>
            )}
            {streamError && (
              <div style={{ color: C.ember, fontSize: 14 }}>{streamError}</div>
            )}
            {!isStreaming && lastAssistantChips.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
                {lastAssistantChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => void send(chip)}
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
              minWidth: 0,
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
            disabled={!input.trim() || isStreaming}
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
              cursor: input.trim() && !isStreaming ? "pointer" : "default",
              opacity: input.trim() && !isStreaming ? 1 : 0.5,
            }}
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
