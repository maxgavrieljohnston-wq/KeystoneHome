import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computePlanMetrics } from "@/lib/plan-metrics";
import { investEdge, projectScenarios } from "@/lib/invest-projection";
import { buildPlanDigest, shouldUseExtendedReasoning } from "@/lib/coach-context";

const COACH_MODEL = "google/gemini-3-flash-preview";
const HISTORY_WINDOW = 12;

const FOLLOWUPS_OPEN = "<<FOLLOWUPS>>";
const FOLLOWUPS_CLOSE = "<<END>>";

// ---------- subscription helpers ----------

async function userHasActiveSub(userId: string, env: "sandbox" | "live") {
  const { data, error } = await supabaseAdmin.rpc("has_active_subscription", {
    user_uuid: userId,
    check_env: env,
  } as never);
  if (error) {
    console.warn("[has_active_subscription]", error);
    return false;
  }
  return Boolean(data);
}

async function userIsPro(userId: string, env: "sandbox" | "live") {
  const allowed = await userHasActiveSub(userId, env);
  if (!allowed) return false;
  const { data: latestSub } = await supabaseAdmin
    .from("subscriptions")
    .select("price_id")
    .eq("user_id", userId)
    .eq("environment", env)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const priceId = (latestSub?.price_id as string | undefined) ?? "";
  return priceId === "pro_monthly" || priceId === "pro_yearly";
}

// ---------- thread management ----------

export const listCoachThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("coach_threads")
      .select("id, title, plan_id, archived, updated_at, created_at")
      .eq("archived", false)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { threads: data ?? [] };
  });

export const createCoachThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        planId: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(120).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: created, error } = await supabaseAdmin
      .from("coach_threads")
      .insert({
        user_id: context.userId,
        plan_id: data.planId ?? null,
        title: data.title ?? "New conversation",
      })
      .select("id, title, plan_id, updated_at")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Failed");
    return { thread: created };
  });

export const renameCoachThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        threadId: z.string().uuid(),
        title: z.string().trim().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("coach_threads")
      .update({ title: data.title })
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCoachThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ threadId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Messages + actions cascade by user_id+thread_id scoping below.
    await supabaseAdmin
      .from("coach_messages")
      .delete()
      .eq("user_id", context.userId)
      .eq("thread_id", data.threadId);
    const { error } = await supabaseAdmin
      .from("coach_threads")
      .delete()
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------- messages + plans ----------

export const getCoachMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ threadId: z.string().uuid().optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("coach_messages")
      .select("id, role, content, created_at, meta, thread_id")
      .order("created_at", { ascending: true });
    if (data.threadId) q = q.eq("thread_id", data.threadId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { messages: rows ?? [] };
  });

export const listCoachPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("plans")
      .select("id, title, created_at, version")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { plans: data ?? [] };
  });

export const getCoachStarters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ planId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    let planQuery = supabaseAdmin
      .from("plans")
      .select("id, title, answers")
      .eq("user_id", userId);
    if (data.planId) planQuery = planQuery.eq("id", data.planId);
    else planQuery = planQuery.order("created_at", { ascending: false }).limit(1);
    const { data: rows } = await planQuery;
    const plan = rows?.[0] ?? null;

    const generic = [
      "Is my homebuying timeline realistic?",
      "What if I invested my down payment instead of saving it?",
      "What lender questions should I ask first?",
    ];
    if (!plan) return { starters: generic };

    try {
      const m = computePlanMetrics((plan.answers as Record<string, unknown>) ?? {}, null);
      const months = Math.max(1, Math.round(m.timelineYears * 12));
      const scenarios = projectScenarios({ saved: m.saved, target: m.downPayment, months });
      const invested = scenarios.find((s) => s.scenario.id === "invested");
      const monthly = invested?.monthly ?? m.monthlyToSave;
      const edge = investEdge({ saved: m.saved, target: m.downPayment, monthly });
      const starters: string[] = [
        `Is my ${m.timelineYears}-year timeline realistic at $${monthly.toLocaleString()}/mo?`,
        edge.monthsSooner > 0
          ? `How does investing get me there ${edge.monthsSooner} months sooner?`
          : `What if I bumped my monthly contribution by $200?`,
        m.verdict === "Difficult" || m.verdict === "A stretch"
          ? `My housing ratio looks tight — what should I change first?`
          : `What lender questions should I ask before applying?`,
      ];
      return { starters };
    } catch (e) {
      console.warn("[coach starters] failed", e);
      return { starters: generic };
    }
  });

// ---------- gateway plumbing ----------

type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };

type ToolCallAccum = {
  index: number;
  id?: string;
  name?: string;
  args: string;
};

async function callGatewayJson(
  apiKey: string,
  messages: GatewayMessage[],
): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: COACH_MODEL, messages }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[coach] AI gateway error", res.status, txt);
    throw new Error(`AI request failed (${res.status})`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

// Coach tool schema for propose-and-apply actions.
const COACH_TOOLS = [
  {
    type: "function",
    function: {
      name: "propose_assumption_change",
      description:
        "Propose changing one of the user's planning assumptions. Use when the user's math would improve materially, or they ask a what-if. Do not call more than twice per reply.",
      parameters: {
        type: "object",
        properties: {
          key: {
            type: "string",
            enum: [
              "mortgageRatePct",
              "pmiPct",
              "expectedReturnPct",
              "hoaMonthly",
              "closingCostPct",
            ],
            description:
              "Assumption key. Percent fields are stored as percent values (e.g. 6.5 for 6.5%), hoaMonthly is dollars/month.",
          },
          value: { type: "number" },
          rationale: { type: "string" },
        },
        required: ["key", "value", "rationale"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_plan_change",
      description:
        "Propose changing one of the user's plan answers — target price, monthly savings, current savings, or target move-in date.",
      parameters: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: [
              "targetPriceOverride",
              "monthlySavings",
              "currentSavings",
              "targetMoveIn",
            ],
          },
          value: {
            type: "string",
            description:
              "For numeric fields, a numeric string like '450000' or '1500'. For targetMoveIn, an ISO date 'YYYY-MM-DD'.",
          },
          rationale: { type: "string" },
        },
        required: ["field", "value", "rationale"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_lender_email",
      description:
        "Draft an email the user can send to a mortgage lender. Use when they are preparing to reach out or have lender-specific questions.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["subject", "body"],
        additionalProperties: false,
      },
    },
  },
];

async function* streamGatewayWithTools(
  apiKey: string,
  messages: GatewayMessage[],
  opts: { reasoningEffort?: "low" | "medium" },
): AsyncGenerator<
  | { type: "delta"; delta: string }
  | { type: "tool"; call: ToolCallAccum }
> {
  const body: Record<string, unknown> = {
    model: COACH_MODEL,
    messages,
    stream: true,
    tools: COACH_TOOLS,
    tool_choice: "auto",
  };
  if (opts.reasoningEffort) body.reasoning = { effort: opts.reasoningEffort };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const txt = res.ok ? "no body" : await res.text().catch(() => "");
    console.error("[coach] stream error", res.status, txt);
    throw new Error(`AI stream failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const tools = new Map<number, ToolCallAccum>();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line || line.startsWith(":")) continue;
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") {
          for (const t of tools.values()) yield { type: "tool", call: t };
          return;
        }
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{
              delta?: {
                content?: string;
                tool_calls?: Array<{
                  index?: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                }>;
              };
            }>;
          };
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) yield { type: "delta", delta: delta.content };
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              const cur =
                tools.get(idx) ?? { index: idx, args: "" };
              if (tc.id) cur.id = tc.id;
              if (tc.function?.name) cur.name = tc.function.name;
              if (tc.function?.arguments) cur.args += tc.function.arguments;
              tools.set(idx, cur);
            }
          }
        } catch {
          buf = line + "\n" + buf;
          break;
        }
      }
    }
    for (const t of tools.values()) yield { type: "tool", call: t };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}

// ---------- threads ----------

async function ensureThread(
  userId: string,
  opts: { threadId?: string; planId?: string; title?: string },
): Promise<{ id: string; summary: string | null; plan_id: string | null; title: string }> {
  if (opts.threadId) {
    const { data } = await supabaseAdmin
      .from("coach_threads")
      .select("id, summary, plan_id, user_id, title")
      .eq("id", opts.threadId)
      .maybeSingle();
    if (data && data.user_id === userId) {
      return { id: data.id, summary: data.summary, plan_id: data.plan_id, title: data.title };
    }
  }
  const { data: existing } = await supabaseAdmin
    .from("coach_threads")
    .select("id, summary, plan_id, title")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (existing && existing[0]) return existing[0];

  const { data: created, error } = await supabaseAdmin
    .from("coach_threads")
    .insert({
      user_id: userId,
      plan_id: opts.planId ?? null,
      title: opts.title ?? "New conversation",
    })
    .select("id, summary, plan_id, title")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Failed to create thread");
  return created;
}

function deriveTitleFromTurn(content: string): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 60) return trimmed;
  return trimmed.slice(0, 57).trimEnd() + "…";
}

// ---------- main send ----------

export const sendCoachMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        content: z.string().trim().min(1).max(4000),
        environment: z.enum(["sandbox", "live"]).default("live"),
        planId: z.string().uuid().optional(),
        threadId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async function* ({ data, context }) {
    const { userId, claims } = context;

    const isPro = await userIsPro(userId, data.environment);
    if (!isPro) throw new Response("Pro plan required", { status: 403 });

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const email = (claims.email as string | undefined)?.toLowerCase();

    let planQuery = supabaseAdmin
      .from("plans")
      .select("id, title, answers, assumptions, current_savings, target_move_in, version, created_at")
      .eq("user_id", userId);
    if (data.planId) planQuery = planQuery.eq("id", data.planId);
    else planQuery = planQuery.order("created_at", { ascending: false }).limit(1);
    const { data: planRows } = await planQuery;
    const plan = planRows?.[0] ?? null;

    const thread = await ensureThread(userId, {
      threadId: data.threadId,
      planId: data.planId ?? plan?.id,
    });

    const { data: history } = await supabaseAdmin
      .from("coach_messages")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });

    const allTurns = (history ?? []) as Array<{ role: string; content: string }>;
    const olderTurns =
      allTurns.length > HISTORY_WINDOW
        ? allTurns.slice(0, allTurns.length - HISTORY_WINDOW)
        : [];
    const recentTurns = allTurns.slice(-HISTORY_WINDOW);
    const isFirstTurn = allTurns.length === 0;

    let rollingSummary = thread.summary ?? "";

    if (olderTurns.length > 0) {
      try {
        const summaryInput = olderTurns
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join("\n\n");
        const newSummary = await callGatewayJson(apiKey, [
          {
            role: "system",
            content:
              "Summarize the following coach conversation in 1 short paragraph (max 120 words). Capture the user's situation, recurring concerns, and any commitments or decisions made. Write in third person.",
          },
          { role: "user", content: summaryInput },
        ]);
        if (newSummary) {
          rollingSummary = newSummary;
          await supabaseAdmin
            .from("coach_threads")
            .update({ summary: newSummary })
            .eq("id", thread.id);
        }
      } catch (e) {
        console.warn("[coach] summary refresh failed", e);
      }
    }

    const planDigest = plan ? buildPlanDigest(plan as never) : "";
    const planContext = planDigest
      ? `User's homebuying plan (use these numbers — do not re-derive):\n${planDigest}`
      : "The user has not yet completed their homebuying plan questionnaire.";

    const summaryBlock = rollingSummary
      ? `\n\nEarlier conversation summary (older turns folded for brevity):\n${rollingSummary}`
      : "";

    const systemPrompt = `You are Keystone Coach, a warm, practical homebuying coach for first-time buyers in the US. Be concise (2-4 short paragraphs max), specific, and actionable. Use the user's plan numbers verbatim — they are pre-computed for you, do not recalculate. A core Keystone message: investing the down-payment savings (rather than parking them in a basic savings account) gets users to their goal months sooner — bring it up naturally when relevant.

When you propose a concrete change to the user's plan — an assumption tweak (rate, expected return, PMI, HOA, closing %), a different target price, monthly savings, savings balance, or move-in date — emit a tool call (propose_assumption_change or propose_plan_change) so the user can Apply it with one click. Mention the proposal briefly in prose ("I'd bump your assumed rate to 6.5% — Apply below"). Don't restate the full numbers in prose. Use draft_lender_email only when they're preparing to contact a lender. Never give legal, tax, or specific investment advice — recommend a professional.

After your reply, on a new line, output exactly one JSON object on its own line in the form:
${FOLLOWUPS_OPEN}{"chips":["short follow-up 1","short follow-up 2","short follow-up 3"]}${FOLLOWUPS_CLOSE}
Each chip must be under 60 chars, written as the user (e.g. "Show me a stretch goal at $200/mo more"), and concretely actionable for this user.

${planContext}${summaryBlock}

User email: ${email ?? "unknown"}`;

    const messages: GatewayMessage[] = [
      { role: "system", content: systemPrompt },
      ...recentTurns.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: data.content },
    ];

    const reasoningEffort: "low" | "medium" = shouldUseExtendedReasoning(data.content)
      ? "medium"
      : "low";

    let buffer = "";
    let yielded = 0;
    let markerHit = false;
    const SAFETY_TAIL = FOLLOWUPS_OPEN.length;
    const collectedTools: ToolCallAccum[] = [];

    try {
      for await (const ev of streamGatewayWithTools(apiKey, messages, { reasoningEffort })) {
        if (ev.type === "tool") {
          collectedTools.push(ev.call);
          continue;
        }
        const delta = ev.delta;
        buffer += delta;
        if (!markerHit) {
          const idx = buffer.indexOf(FOLLOWUPS_OPEN);
          if (idx !== -1) {
            if (idx > yielded) {
              yield { type: "delta" as const, delta: buffer.slice(yielded, idx) };
              yielded = idx;
            }
            markerHit = true;
          } else {
            const safe = Math.max(yielded, buffer.length - SAFETY_TAIL);
            if (safe > yielded) {
              yield { type: "delta" as const, delta: buffer.slice(yielded, safe) };
              yielded = safe;
            }
          }
        }
      }
    } catch (e) {
      console.error("[coach] stream failed", e);
      throw e;
    }

    if (!markerHit && yielded < buffer.length) {
      yield { type: "delta" as const, delta: buffer.slice(yielded) };
      yielded = buffer.length;
    }

    let reply = buffer;
    let chips: string[] = [];
    const match = buffer.match(/<<FOLLOWUPS>>([\s\S]*?)<<END>>/);
    if (match) {
      reply = buffer.replace(match[0], "").trim();
      try {
        const parsed = JSON.parse(match[1].trim()) as { chips?: unknown };
        if (Array.isArray(parsed.chips)) {
          chips = parsed.chips
            .filter((c): c is string => typeof c === "string")
            .map((c) => c.trim())
            .filter((c) => c.length > 0 && c.length <= 80)
            .slice(0, 3);
        }
      } catch {
        /* ignore malformed chips */
      }
    } else {
      reply = buffer.trim();
    }
    if (!reply) reply = "Sorry, I had trouble responding.";

    const { data: inserted } = await supabaseAdmin
      .from("coach_messages")
      .insert([
        {
          user_id: userId,
          thread_id: thread.id,
          role: "user",
          content: data.content,
          meta: data.planId ? { plan_id: data.planId } : null,
        },
        {
          user_id: userId,
          thread_id: thread.id,
          role: "assistant",
          content: reply,
          meta: chips.length > 0 ? { chips } : null,
        },
      ])
      .select("id, role");

    const assistantId = inserted?.find((r) => r.role === "assistant")?.id ?? null;

    // Persist tool-call proposals as actions tied to the assistant message.
    const insertedActions: Array<{ id: string; kind: string; payload: any }> = [];
    if (assistantId && collectedTools.length > 0) {
      const rows = collectedTools
        .map((t) => {
          if (!t.name) return null;
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(t.args || "{}");
          } catch {
            return null;
          }
          if (!["propose_assumption_change", "propose_plan_change", "draft_lender_email"].includes(t.name)) {
            return null;
          }
          return {
            user_id: userId,
            message_id: assistantId,
            kind: t.name,
            payload: { ...parsedArgs, plan_id: data.planId ?? plan?.id ?? null } as any,
            status: "proposed",
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (rows.length > 0) {
        const { data: actionRows } = await supabaseAdmin
          .from("coach_message_actions")
          .insert(rows)
          .select("id, kind, payload");
        if (actionRows) insertedActions.push(...(actionRows as any[]));
      }
    }


    // Auto-title thread after the first user turn if still default.
    if (
      isFirstTurn &&
      (thread.title === "New conversation" || !thread.title)
    ) {
      const newTitle = deriveTitleFromTurn(data.content);
      await supabaseAdmin
        .from("coach_threads")
        .update({ title: newTitle, updated_at: new Date().toISOString() })
        .eq("id", thread.id);
    } else {
      await supabaseAdmin
        .from("coach_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", thread.id);
    }

    yield {
      type: "done" as const,
      chips,
      reply,
      threadId: thread.id,
      assistantMessageId: assistantId,
      actions: insertedActions,
    };
  });

// ---------- actions: list / apply / dismiss ----------

export const listCoachActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ messageIds: z.array(z.string().uuid()).max(200) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.messageIds.length === 0) return { actions: [] };
    const { data: rows, error } = await supabaseAdmin
      .from("coach_message_actions")
      .select("id, message_id, kind, payload, status, applied_at, created_at")
      .eq("user_id", context.userId)
      .in("message_id", data.messageIds)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { actions: rows ?? [] };
  });

export const dismissCoachAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ actionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("coach_message_actions")
      .update({ status: "dismissed" })
      .eq("id", data.actionId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const ASSUMPTION_KEYS = new Set([
  "mortgageRatePct",
  "pmiPct",
  "expectedReturnPct",
  "hoaMonthly",
  "closingCostPct",
]);

const ANSWER_FIELDS = new Set([
  "targetPriceOverride",
  "monthlySavings",
  "currentSavings",
  "targetMoveIn",
]);

export const applyCoachAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        actionId: z.string().uuid(),
        environment: z.enum(["sandbox", "live"]).default("live"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const allowed = await userHasActiveSub(userId, data.environment);
    if (!allowed) throw new Response("Upgrade required", { status: 403 });

    const { data: action, error: readErr } = await supabaseAdmin
      .from("coach_message_actions")
      .select("id, kind, payload, status, user_id")
      .eq("id", data.actionId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!action || action.user_id !== userId)
      throw new Response("Not found", { status: 404 });
    if (action.status !== "proposed")
      return { ok: true as const, alreadyHandled: true };

    const payload = (action.payload ?? {}) as Record<string, any>;
    const planId = (payload.plan_id as string | undefined) ?? null;

    // Locate the target plan.
    type PlanRow = { id: string; answers: Record<string, unknown> | null; assumptions: Record<string, unknown> | null };
    let plan: PlanRow | null = null;
    if (planId) {
      const { data: row } = await supabaseAdmin
        .from("plans")
        .select("id, answers, assumptions")
        .eq("id", planId)
        .eq("user_id", userId)
        .maybeSingle();
      if (row) plan = row as unknown as PlanRow;
    }
    if (!plan) {
      const { data: row } = await supabaseAdmin
        .from("plans")
        .select("id, answers, assumptions")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (row) plan = row as unknown as PlanRow;
    }


    if (action.kind === "draft_lender_email") {
      // Nothing to mutate server-side; UI opens mailto. Just mark applied.
      await supabaseAdmin
        .from("coach_message_actions")
        .update({ status: "applied", applied_at: new Date().toISOString() })
        .eq("id", action.id);
      return { ok: true as const, kind: "draft_lender_email" as const, payload: payload as any };
    }


    if (!plan) throw new Response("No plan to update", { status: 400 });

    if (action.kind === "propose_assumption_change") {
      const key = String(payload.key ?? "");
      const value = Number(payload.value);
      if (!ASSUMPTION_KEYS.has(key) || !Number.isFinite(value)) {
        throw new Response("Invalid assumption", { status: 400 });
      }
      const merged = { ...(plan.assumptions ?? {}), [key]: value };
      const { error } = await supabaseAdmin
        .from("plans")
        .update({ assumptions: merged as never })
        .eq("id", plan.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else if (action.kind === "propose_plan_change") {
      const field = String(payload.field ?? "");
      if (!ANSWER_FIELDS.has(field)) {
        throw new Response("Invalid field", { status: 400 });
      }
      const raw = payload.value;
      if (field === "targetMoveIn") {
        const date = String(raw ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new Response("Invalid date", { status: 400 });
        }
        const { error } = await supabaseAdmin
          .from("plans")
          .update({ target_move_in: date as never })
          .eq("id", plan.id)
          .eq("user_id", userId);
        if (error) throw new Error(error.message);
      } else {
        const num = Number(raw);
        if (!Number.isFinite(num) || num < 0) {
          throw new Response("Invalid value", { status: 400 });
        }
        if (field === "currentSavings") {
          const { error } = await supabaseAdmin
            .from("plans")
            .update({ current_savings: num as never })
            .eq("id", plan.id)
            .eq("user_id", userId);
          if (error) throw new Error(error.message);
        } else {
          const merged = { ...(plan.answers ?? {}), [field]: num };
          const { error } = await supabaseAdmin
            .from("plans")
            .update({ answers: merged as never })
            .eq("id", plan.id)
            .eq("user_id", userId);
          if (error) throw new Error(error.message);
        }
      }
    } else {
      throw new Response("Unknown action kind", { status: 400 });
    }

    await supabaseAdmin
      .from("coach_message_actions")
      .update({ status: "applied", applied_at: new Date().toISOString() })
      .eq("id", action.id);

    return { ok: true as const, kind: action.kind as "propose_assumption_change" | "propose_plan_change", payload: payload as any };
  });

// ---------- clear current thread ----------

export const clearCoachHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ threadId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (data.threadId) {
      await supabaseAdmin
        .from("coach_messages")
        .delete()
        .eq("user_id", context.userId)
        .eq("thread_id", data.threadId);
      await supabaseAdmin
        .from("coach_threads")
        .update({ summary: null })
        .eq("id", data.threadId)
        .eq("user_id", context.userId);
    } else {
      await supabaseAdmin
        .from("coach_messages")
        .delete()
        .eq("user_id", context.userId);
      await supabaseAdmin
        .from("coach_threads")
        .update({ summary: null })
        .eq("user_id", context.userId);
    }
    return { ok: true as const };
  });
