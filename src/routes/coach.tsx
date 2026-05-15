import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
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

function CoachPage() {
  const auth = useAuthReady();
  const sub = useSubscription();
  const navigate = useNavigate();
  const gate = useUpgradeGate();
  const qc = useQueryClient();
  const fetchMsgs = useServerFn(getCoachMessages);
  const sendMsg = useServerFn(sendCoachMessage);
  const clearMsgs = useServerFn(clearCoachHistory);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // If not Pro, show paywall card immediately
  const proLocked = !sub.loading && !sub.isPro;

  const { data, isLoading } = useQuery({
    queryKey: ["coach-messages", auth.user?.id],
    queryFn: () => fetchMsgs(),
    enabled: auth.ready && !!auth.user && !proLocked,
  });

  const send = useMutation({
    mutationFn: async (content: string) => {
      return sendMsg({ data: { content, environment: getPaddleEnvironment() } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-messages"] }),
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
    setInput("");
    send.mutate(text);
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
          padding: "20px 24px",
          borderBottom: `1px solid ${C.ink}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 720,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <Link to="/dashboard" style={{ color: C.inkMute, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", textDecoration: "none" }}>
          ← Dashboard
        </Link>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ember }}>
          Coach
        </div>
        {!proLocked && (data?.messages?.length ?? 0) > 0 ? (
          <button
            type="button"
            onClick={() => clear.mutate()}
            style={{ background: "transparent", border: "none", color: C.inkMute, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer" }}
          >
            Clear
          </button>
        ) : <span style={{ width: 40 }} />}
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
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ember, marginBottom: 12 }}>
              Pro feature
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
              Your personal homebuying coach
            </h1>
            <p style={{ color: C.inkSoft, fontSize: 17, lineHeight: 1.5, maxWidth: 460, margin: "0 auto 24px" }}>
              Ask anything about your homebuying plan. The coach uses your saved answers as context.
            </p>
            <button
              type="button"
              onClick={() => gate.openUpgrade("pro", "AI homebuying coach")}
              style={{
                background: C.ink, color: C.paper, padding: "14px 22px", border: "none", borderRadius: 8,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
              }}
            >
              Upgrade to Pro →
            </button>
          </div>
        ) : isLoading ? (
          <p style={{ color: C.inkMute }}>Loading…</p>
        ) : (data?.messages?.length ?? 0) === 0 ? (
          <div style={{ color: C.inkSoft, fontSize: 17, lineHeight: 1.5, padding: "20px 0" }}>
            <p>Hi — I'm your Keystone Coach. Ask me anything about your homebuying plan.</p>
            <p style={{ color: C.inkMute, fontSize: 14, marginTop: 16 }}>
              Try: "How can I improve my credit score before applying?" or "Is my timeline realistic?"
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {data!.messages.map((m) => (
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
                  fontSize: 16,
                  lineHeight: 1.5,
                }}
              >
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            ))}
            {send.isPending && (
              <div style={{ alignSelf: "flex-start", color: C.inkMute, fontStyle: "italic", fontSize: 15 }}>
                Coach is thinking…
              </div>
            )}
            {send.isError && (
              <div style={{ color: C.ember, fontSize: 14 }}>
                Couldn't send that message. Try again.
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
              background: C.ink, color: C.paper, padding: "0 20px", border: "none", borderRadius: 8,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
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
