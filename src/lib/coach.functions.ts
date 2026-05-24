import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computePlanMetrics } from "@/lib/plan-metrics";
import { investEdge, projectScenarios } from "@/lib/invest-projection";
import { buildPlanDigest, shouldUseExtendedReasoning } from "@/lib/coach-context";

const COACH_MODEL = "google/gemini-3-flash-preview";

// Sliding window: keep this many most-recent turns verbatim. Anything older
// is folded into a rolling summary stored on profiles.coach_summary.
const HISTORY_WINDOW = 12;

// Marker used to ask the model to append follow-up chips at the END of its
// response. We strip this from streamed output so the user never sees it.
const FOLLOWUPS_OPEN = "<<FOLLOWUPS>>";
const FOLLOWUPS_CLOSE = "<<END>>";

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

export const getCoachMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("coach_messages")
      .select("id, role, content, created_at, meta")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { messages: data ?? [] };
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

// Plan-aware starter prompts for the empty state.
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
    if (data.planId) {
      planQuery = planQuery.eq("id", data.planId);
    } else {
      planQuery = planQuery.order("created_at", { ascending: false }).limit(1);
    }
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

type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };

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

// Parse SSE deltas from a streaming gateway response.
async function* streamGateway(
  apiKey: string,
  messages: GatewayMessage[],
  opts?: { reasoningEffort?: "low" | "medium" },
): AsyncGenerator<string> {
  const body: Record<string, unknown> = {
    model: COACH_MODEL,
    messages,
    stream: true,
  };
  if (opts?.reasoningEffort) {
    body.reasoning = { effort: opts.reasoningEffort };
  }
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
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          buf = line + "\n" + buf;
          break;
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}

export const sendCoachMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        content: z.string().trim().min(1).max(4000),
        environment: z.enum(["sandbox", "live"]).default("live"),
        planId: z.string().uuid().optional(),
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

    // Active plan (selected or latest).
    let planQuery = supabaseAdmin
      .from("plans")
      .select("id, title, answers, created_at")
      .eq("user_id", userId);
    if (data.planId) {
      planQuery = planQuery.eq("id", data.planId);
    } else {
      planQuery = planQuery.order("created_at", { ascending: false }).limit(1);
    }
    const { data: planRows } = await planQuery;
    const plan = planRows?.[0] ?? null;

    // Full chat history → recent window + older to summarize.
    const { data: history } = await supabaseAdmin
      .from("coach_messages")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    const allTurns = (history ?? []) as Array<{ role: string; content: string }>;
    const olderTurns =
      allTurns.length > HISTORY_WINDOW
        ? allTurns.slice(0, allTurns.length - HISTORY_WINDOW)
        : [];
    const recentTurns = allTurns.slice(-HISTORY_WINDOW);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("coach_summary")
      .eq("user_id", userId)
      .maybeSingle();
    let rollingSummary = (profile?.coach_summary as string | null) ?? "";

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
            .from("profiles")
            .update({ coach_summary: newSummary })
            .eq("user_id", userId);
        }
      } catch (e) {
        console.warn("[coach] summary refresh failed", e);
      }
    }

    // Structured plan digest (numbers + verdict + invest delta), used in place
    // of dumping the raw `answers` JSON into the prompt.
    const planDigest = plan ? buildPlanDigest(plan as never) : "";
    const planContext = planDigest
      ? `User's homebuying plan (use these numbers — do not re-derive):\n${planDigest}`
      : "The user has not yet completed their homebuying plan questionnaire.";

    const summaryBlock = rollingSummary
      ? `\n\nEarlier conversation summary (older turns folded for brevity):\n${rollingSummary}`
      : "";

    const systemPrompt = `You are Keystone Coach, a warm, practical homebuying coach for first-time buyers in the US. Be concise (2-4 short paragraphs max), specific, and actionable. Use the user's plan numbers verbatim — they are pre-computed for you, do not recalculate. A core Keystone message: investing the down-payment savings (rather than parking them in a basic savings account) gets users to their goal months sooner — bring it up naturally when relevant. When you don't know something (e.g. exact current mortgage rates today), say so and explain how to find out. Never give legal, tax, or specific investment advice — recommend a professional.\n\nAfter your reply, on a new line, output exactly one JSON object on its own line in the form:\n${FOLLOWUPS_OPEN}{"chips":["short follow-up 1","short follow-up 2","short follow-up 3"]}${FOLLOWUPS_CLOSE}\nEach chip must be under 60 chars, written as the user (e.g. "Show me a stretch goal at $200/mo more"), and concretely actionable for this user.\n\n${planContext}${summaryBlock}\n\nUser email: ${email ?? "unknown"}`;

    const messages: GatewayMessage[] = [
      { role: "system", content: systemPrompt },
      ...recentTurns.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as
          | "user"
          | "assistant",
        content: m.content,
      })),
      { role: "user", content: data.content },
    ];

    const reasoningEffort: "low" | "medium" = shouldUseExtendedReasoning(
      data.content,
    )
      ? "medium"
      : "low";

    // Stream tokens. Buffer the full text to extract chips at the end, but
    // never yield text that's part of the FOLLOWUPS marker block.
    let buffer = "";
    let yielded = 0; // chars already emitted from `buffer`
    let markerHit = false;
    const SAFETY_TAIL = FOLLOWUPS_OPEN.length; // hold back this many chars

    try {
      for await (const delta of streamGateway(apiKey, messages, { reasoningEffort })) {
        buffer += delta;
        if (!markerHit) {
          const idx = buffer.indexOf(FOLLOWUPS_OPEN);
          if (idx !== -1) {
            // Flush everything up to the marker, then stop emitting.
            if (idx > yielded) {
              yield { type: "delta" as const, delta: buffer.slice(yielded, idx) };
              yielded = idx;
            }
            markerHit = true;
          } else {
            // Hold back a tail in case the marker straddles chunks.
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

    // Flush any held-back tail if we never saw the marker.
    if (!markerHit && yielded < buffer.length) {
      yield { type: "delta" as const, delta: buffer.slice(yielded) };
      yielded = buffer.length;
    }

    // Extract reply + chips from the full buffer.
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

    // Persist user + assistant turns now that the call succeeded.
    await supabaseAdmin.from("coach_messages").insert([
      {
        user_id: userId,
        role: "user",
        content: data.content,
        meta: data.planId ? { plan_id: data.planId } : null,
      },
      {
        user_id: userId,
        role: "assistant",
        content: reply,
        meta: chips.length > 0 ? { chips } : null,
      },
    ]);

    yield { type: "done" as const, chips, reply };
  });

export const clearCoachHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("coach_messages")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ coach_summary: null })
      .eq("user_id", context.userId);
    return { ok: true as const };
  });
