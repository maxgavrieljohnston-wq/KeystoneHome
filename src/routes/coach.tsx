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
  listCoachThreads,
  createCoachThread,
  renameCoachThread,
  deleteCoachThread,
  listCoachActions,
  applyCoachAction,
  dismissCoachAction,
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
          ul: ({ children }) => <ul style={{ margin: "4px 0 12px", paddingLeft: 22 }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: "4px 0 12px", paddingLeft: 22 }}>{children}</ol>,
          li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" style={{ color: linkColor, textDecoration: "underline" }}>
              {children}
            </a>
          ),
          strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
          code: ({ children }) => (
            <code style={{ fontFamily: mono, fontSize: "0.88em", background: codeBg, padding: "1px 5px", borderRadius: 4 }}>
              {children}
            </code>
          ),
          h1: ({ children }) => <h3 style={{ fontSize: 19, margin: "8px 0 8px", fontWeight: 600 }}>{children}</h3>,
          h2: ({ children }) => <h4 style={{ fontSize: 17, margin: "8px 0 6px", fontWeight: 600 }}>{children}</h4>,
          h3: ({ children }) => <h5 style={{ fontSize: 16, margin: "6px 0 4px", fontWeight: 600 }}>{children}</h5>,
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

type LocalMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: { chips?: string[]; plan_id?: string } | null;
  pending?: boolean;
};

type CoachAction = {
  id: string;
  message_id: string;
  kind: "propose_assumption_change" | "propose_plan_change" | "draft_lender_email";
  payload: Record<string, any>;
  status: "proposed" | "applied" | "dismissed";
};

const ASSUMPTION_LABELS: Record<string, { name: string; unit: string }> = {
  mortgageRatePct: { name: "Mortgage rate", unit: "%" },
  pmiPct: { name: "PMI rate", unit: "%" },
  expectedReturnPct: { name: "Expected investment return", unit: "%" },
  hoaMonthly: { name: "HOA fees", unit: "/mo" },
  closingCostPct: { name: "Closing costs", unit: "%" },
};
const ANSWER_LABELS: Record<string, { name: string; unit: string }> = {
  targetPriceOverride: { name: "Target home price", unit: "$" },
  monthlySavings: { name: "Monthly savings", unit: "$/mo" },
  currentSavings: { name: "Current savings", unit: "$" },
  targetMoveIn: { name: "Target move-in", unit: "" },
};

function formatActionValue(unit: string, value: any): string {
  if (unit === "$" || unit === "$/mo") {
    const n = Number(value);
    return Number.isFinite(n) ? "$" + n.toLocaleString() + (unit === "$/mo" ? "/mo" : "") : String(value);
  }
  if (unit === "%") {
    const n = Number(value);
    return Number.isFinite(n) ? n + "%" : String(value);
  }
  if (unit === "/mo") {
    const n = Number(value);
    return Number.isFinite(n) ? "$" + n.toLocaleString() + "/mo" : String(value);
  }
  return String(value ?? "");
}

function ActionCard({
  action,
  onApply,
  onDismiss,
  busy,
}: {
  action: CoachAction;
  onApply: (a: CoachAction) => void;
  onDismiss: (a: CoachAction) => void;
  busy: boolean;
}) {
  const applied = action.status === "applied";
  const dismissed = action.status === "dismissed";

  let title = "Suggested change";
  let value = "";
  let rationale = String(action.payload?.rationale ?? "");

  if (action.kind === "propose_assumption_change") {
    const key = String(action.payload?.key ?? "");
    const meta = ASSUMPTION_LABELS[key];
    title = meta ? `Update ${meta.name}` : `Update ${key}`;
    value = meta ? formatActionValue(meta.unit, action.payload?.value) : String(action.payload?.value ?? "");
  } else if (action.kind === "propose_plan_change") {
    const field = String(action.payload?.field ?? "");
    const meta = ANSWER_LABELS[field];
    title = meta ? `Update ${meta.name}` : `Update ${field}`;
    value = meta ? formatActionValue(meta.unit, action.payload?.value) : String(action.payload?.value ?? "");
  } else if (action.kind === "draft_lender_email") {
    title = "Drafted lender email";
    value = String(action.payload?.subject ?? "");
  }

  return (
    <div
      style={{
        border: `1px solid ${applied ? C.inkFaint : C.ink}`,
        background: applied ? "rgba(0,0,0,0.02)" : "#fff",
        borderRadius: 10,
        padding: "12px 14px",
        marginTop: 10,
        opacity: dismissed ? 0.5 : 1,
      }}
    >
      <div
        style={{
          fontFamily: mono,
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: applied ? C.inkMute : C.ember,
          marginBottom: 6,
        }}
      >
        {applied ? "Applied" : dismissed ? "Dismissed" : "Coach suggests"}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontSize: 15, color: C.ink, fontWeight: 500 }}>{title}</div>
        {value && (
          <div style={{ fontFamily: mono, fontSize: 13, color: C.ink, whiteSpace: "nowrap" }}>{value}</div>
        )}
      </div>
      {rationale && (
        <div style={{ fontSize: 14, color: C.inkSoft, marginTop: 6, lineHeight: 1.45 }}>{rationale}</div>
      )}
      {action.kind === "draft_lender_email" && !dismissed && (
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 8, whiteSpace: "pre-wrap" }}>
          {String(action.payload?.body ?? "").slice(0, 280)}
          {String(action.payload?.body ?? "").length > 280 ? "…" : ""}
        </div>
      )}
      {!applied && !dismissed && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => onApply(action)}
            style={{
              background: C.ink,
              color: C.paper,
              border: "none",
              borderRadius: 6,
              padding: "8px 14px",
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {action.kind === "draft_lender_email" ? "Open email" : "Apply"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDismiss(action)}
            style={{
              background: "transparent",
              color: C.inkMute,
              border: `1px solid ${C.inkFaint}`,
              borderRadius: 6,
              padding: "8px 14px",
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: busy ? "default" : "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

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
  const fetchThreads = useServerFn(listCoachThreads);
  const createThread = useServerFn(createCoachThread);
  const renameThread = useServerFn(renameCoachThread);
  const removeThread = useServerFn(deleteCoachThread);
  const fetchActions = useServerFn(listCoachActions);
  const applyAction = useServerFn(applyCoachAction);
  const dismissAction = useServerFn(dismissCoachAction);

  const [input, setInput] = useState("");
  const [planId, setPlanId] = useState<string | "">("");
  const [threadId, setThreadId] = useState<string | "">("");
  const [pending, setPending] = useState<LocalMsg[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const proLocked = !sub.loading && !sub.isPro;
  const enabled = auth.ready && !!auth.user && !proLocked;

  const { data: threadsData } = useQuery({
    queryKey: ["coach-threads", auth.user?.id],
    queryFn: () => fetchThreads(),
    enabled,
  });
  const threads = threadsData?.threads ?? [];

  // Select most recent thread on first load.
  useEffect(() => {
    if (!threadId && threads.length > 0) setThreadId(threads[0].id);
  }, [threads, threadId]);

  const { data, isLoading } = useQuery({
    queryKey: ["coach-messages", auth.user?.id, threadId],
    queryFn: () => fetchMsgs({ data: { threadId: threadId || undefined } }),
    enabled: enabled && !!threadId,
  });

  const { data: plansData } = useQuery({
    queryKey: ["coach-plans", auth.user?.id],
    queryFn: () => fetchPlans(),
    enabled,
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
    enabled,
  });
  const starters = startersData?.starters ?? [];

  const messages = (data?.messages ?? []) as CoachMsg[];
  const assistantIds = useMemo(
    () => messages.filter((m) => m.role === "assistant").map((m) => m.id),
    [messages],
  );

  const { data: actionsData } = useQuery({
    queryKey: ["coach-actions", auth.user?.id, threadId, assistantIds.join(",")],
    queryFn: () => fetchActions({ data: { messageIds: assistantIds } }),
    enabled: enabled && assistantIds.length > 0,
  });
  const actions = (actionsData?.actions ?? []) as CoachAction[];
  const actionsByMessage = useMemo(() => {
    const map = new Map<string, CoachAction[]>();
    for (const a of actions) {
      const list = map.get(a.message_id) ?? [];
      list.push(a);
      map.set(a.message_id, list);
    }
    return map;
  }, [actions]);

  const clear = useMutation({
    mutationFn: () => clearMsgs({ data: { threadId: threadId || undefined } }),
    onSuccess: () => {
      setPending([]);
      setStreamingText("");
      setStreamError(null);
      qc.invalidateQueries({ queryKey: ["coach-messages"] });
      qc.invalidateQueries({ queryKey: ["coach-actions"] });
    },
  });

  // Combine server messages, optimistic pending user message, and streaming.
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
    const activeThreadId = threadId || undefined;
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
          threadId: activeThreadId,
        },
      });
      let acc = "";
      let resolvedThreadId: string | undefined;
      for await (const chunk of stream as AsyncIterable<
        | { type: "delta"; delta: string }
        | { type: "done"; chips: string[]; reply: string; threadId: string; assistantMessageId: string | null; actions: any[] }
      >) {
        if (chunk.type === "delta") {
          acc += chunk.delta;
          setStreamingText(acc);
        } else if (chunk.type === "done") {
          resolvedThreadId = chunk.threadId;
        }
      }
      if (resolvedThreadId && resolvedThreadId !== threadId) {
        setThreadId(resolvedThreadId);
      }
    } catch (e) {
      console.error("[coach] send failed", e);
      setStreamError("Couldn't send that message. Try again.");
      setPending([]);
      setInput(content);
    } finally {
      setIsStreaming(false);
      setStreamingText("");
      setPending([]);
      qc.invalidateQueries({ queryKey: ["coach-messages"] });
      qc.invalidateQueries({ queryKey: ["coach-threads"] });
      qc.invalidateQueries({ queryKey: ["coach-actions"] });
    }
  };

  const handleApply = async (a: CoachAction) => {
    setActionBusyId(a.id);
    try {
      const res = await applyAction({ data: { actionId: a.id, environment: getStripeEnvironment() } });
      if (a.kind === "draft_lender_email") {
        const subject = encodeURIComponent(String(a.payload?.subject ?? ""));
        const body = encodeURIComponent(String(a.payload?.body ?? ""));
        window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
      } else {
        // Plan changed — refresh dashboards/metrics anywhere.
        qc.invalidateQueries({ queryKey: ["plan-metrics"] });
        qc.invalidateQueries({ queryKey: ["my-plans"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["coach-starters"] });
      }
      void res;
    } catch (e) {
      console.error("[coach] apply failed", e);
    } finally {
      setActionBusyId(null);
      qc.invalidateQueries({ queryKey: ["coach-actions"] });
    }
  };

  const handleDismiss = async (a: CoachAction) => {
    setActionBusyId(a.id);
    try {
      await dismissAction({ data: { actionId: a.id } });
    } finally {
      setActionBusyId(null);
      qc.invalidateQueries({ queryKey: ["coach-actions"] });
    }
  };

  const handleNewThread = async () => {
    try {
      const res = await createThread({ data: { planId: planId || undefined } });
      setThreadId(res.thread.id);
      qc.invalidateQueries({ queryKey: ["coach-threads"] });
    } catch (e) {
      console.error("[coach] create thread failed", e);
    }
  };

  const handleRenameThread = async () => {
    if (!threadId) return;
    const cur = threads.find((t) => t.id === threadId);
    const next = window.prompt("Rename conversation", cur?.title ?? "")?.trim();
    if (!next) return;
    try {
      await renameThread({ data: { threadId, title: next } });
      qc.invalidateQueries({ queryKey: ["coach-threads"] });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteThread = async () => {
    if (!threadId) return;
    if (!window.confirm("Delete this conversation? This can't be undone.")) return;
    try {
      await removeThread({ data: { threadId } });
      setThreadId("");
      qc.invalidateQueries({ queryKey: ["coach-threads"] });
      qc.invalidateQueries({ queryKey: ["coach-messages"] });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = (content: string) => {
    void navigator.clipboard?.writeText(content);
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
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
          {!proLocked ? (
            <button
              type="button"
              onClick={handleNewThread}
              aria-label="New conversation"
              title="New conversation"
              style={{
                background: "transparent",
                border: `1px solid ${C.ink}`,
                color: C.ink,
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
              +
            </button>
          ) : (
            <span style={{ width: 28 }} />
          )}
        </div>

        {!proLocked && threads.length > 0 && (
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
            <span style={{ flexShrink: 0 }}>Conversation</span>
            <select
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
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
              {threads.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title || "Untitled"}
                </option>
              ))}
            </select>
            {threadId && (
              <>
                <button
                  type="button"
                  onClick={handleRenameThread}
                  title="Rename"
                  style={{
                    background: "transparent",
                    border: `1px solid ${C.inkFaint}`,
                    borderRadius: 6,
                    padding: "6px 8px",
                    fontFamily: mono,
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: C.inkMute,
                    cursor: "pointer",
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={handleDeleteThread}
                  title="Delete"
                  style={{
                    background: "transparent",
                    border: `1px solid ${C.inkFaint}`,
                    borderRadius: 6,
                    padding: "6px 8px",
                    fontFamily: mono,
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: C.inkMute,
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}

        {!proLocked && plans.length > 1 && (
          <div
            style={{
              marginTop: 8,
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
        )}
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
            <h1 style={{ fontSize: 36, fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 12px", textAlign: "center" }}>
              Your personal homebuying coach
            </h1>
            <p style={{ color: C.inkSoft, fontSize: 17, lineHeight: 1.5, maxWidth: 460, margin: "0 auto 24px", textAlign: "center" }}>
              Trained on your saved plan answers — invest-vs-save math, timeline, savings goal, and the lender questions
              you haven't asked yet.
            </p>
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
        ) : isLoading && threadId ? (
          <p style={{ color: C.inkMute }}>Loading…</p>
        ) : view.length === 0 ? (
          <div style={{ color: C.inkSoft, fontSize: 17, lineHeight: 1.5, padding: "20px 0" }}>
            <p style={{ margin: "0 0 8px" }}>Hi — I'm your Keystone Coach. Ask me anything about your homebuying plan.</p>
            <p
              style={{
                color: C.inkMute,
                fontSize: 13,
                margin: "16px 0 10px",
                fontFamily: mono,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
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
              const msgActions = m.role === "assistant" && !m.pending ? actionsByMessage.get(m.id) ?? [] : [];
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
                    width: m.role === "assistant" ? "100%" : "auto",
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
                      maxWidth: m.role === "assistant" ? "100%" : undefined,
                    }}
                  >
                    <CoachMarkdown dark={m.role === "user"}>{m.content}</CoachMarkdown>
                  </div>
                  {m.role === "assistant" && !m.pending && (
                    <button
                      type="button"
                      onClick={() => handleCopy(m.content)}
                      title="Copy"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: C.inkMute,
                        fontFamily: mono,
                        fontSize: 10,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        padding: "2px 0",
                      }}
                    >
                      Copy
                    </button>
                  )}
                  {msgActions.map((a) => (
                    <div key={a.id} style={{ width: "100%" }}>
                      <ActionCard
                        action={a}
                        onApply={handleApply}
                        onDismiss={handleDismiss}
                        busy={actionBusyId === a.id}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
            {isStreaming && !streamingText && (
              <div style={{ alignSelf: "flex-start", color: C.inkMute, fontStyle: "italic", fontSize: 15 }}>
                Coach is thinking…
              </div>
            )}
            {streamError && <div style={{ color: C.ember, fontSize: 14 }}>{streamError}</div>}
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
            {!isStreaming && (messages.length > 0 || pending.length > 0) && (
              <div style={{ paddingTop: 8 }}>
                <button
                  type="button"
                  onClick={() => clear.mutate()}
                  style={{
                    background: "transparent",
                    border: `1px solid ${C.inkFaint}`,
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontFamily: mono,
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: C.inkMute,
                    cursor: "pointer",
                  }}
                >
                  Clear conversation
                </button>
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
