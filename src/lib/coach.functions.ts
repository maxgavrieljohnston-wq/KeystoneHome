import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computePlanMetrics } from "@/lib/plan-metrics";
import { investEdge, projectScenarios } from "@/lib/invest-projection";

// Sliding window: keep this many most-recent turns verbatim. Anything older
// is folded into a rolling summary stored on profiles.coach_summary.
const HISTORY_WINDOW = 12;

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

type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };

async function callGateway(
  apiKey: string,
  messages: GatewayMessage[],
  opts: { responseFormat?: "json" } = {},
): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      ...(opts.responseFormat === "json"
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
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
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;

    // Pro entitlement required.
    const allowed = await userHasActiveSub(userId, data.environment);
    if (!allowed) throw new Response("Upgrade required", { status: 403 });
    const { data: latestSub } = await supabaseAdmin
      .from("subscriptions")
      .select("price_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const priceId = (latestSub?.price_id as string | undefined) ?? "";
    const isPro = priceId === "pro_monthly" || priceId === "pro_yearly";
    if (!isPro) throw new Response("Pro plan required", { status: 403 });

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const email = (claims.email as string | undefined)?.toLowerCase();

    // Load the requested plan (or latest if none specified).
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

    // Load full chat history (we'll slice into recent + summarize older).
    const { data: history } = await supabaseAdmin
      .from("coach_messages")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    const allTurns = (history ?? []) as Array<{ role: string; content: string }>;
    const olderTurns = allTurns.length > HISTORY_WINDOW
      ? allTurns.slice(0, allTurns.length - HISTORY_WINDOW)
      : [];
    const recentTurns = allTurns.slice(-HISTORY_WINDOW);

    // Load existing rolling summary.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("coach_summary")
      .eq("user_id", userId)
      .maybeSingle();
    let rollingSummary = (profile?.coach_summary as string | null) ?? "";

    // If we have older turns, regenerate the summary so it covers everything
    // outside the recent window. Cheap call; only fires once history > 12.
    if (olderTurns.length > 0) {
      try {
        const summaryInput = olderTurns
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join("\n\n");
        const newSummary = await callGateway(apiKey, [
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

    let investContext = "";
    if (plan) {
      try {
        const m = computePlanMetrics(
          (plan.answers as Record<string, unknown>) ?? {},
          null,
        );
        const months = Math.max(1, Math.round(m.timelineYears * 12));
        const scenarios = projectScenarios({ saved: m.saved, target: m.downPayment, months });
        const invested = scenarios.find((s) => s.scenario.id === "invested")!;
        const edge = investEdge({ saved: m.saved, target: m.downPayment, monthly: invested.monthly });
        investContext = `\n\nInvest-vs-save delta (Keystone's core thesis — reference these naturally):\n- Down-payment goal: $${m.downPayment.toLocaleString()} in ${m.timelineYears} years\n- Currently saved: $${m.saved.toLocaleString()}\n- Required at 7% (invested): $${invested.monthly.toLocaleString()}/mo, growth contributes $${invested.growth.toLocaleString()}\n- Investing instead of using a basic savings account at the same monthly contribution gets the user there ${edge.monthsSooner} months sooner and saves them $${edge.dollarsSaved.toLocaleString()} in contributions.`;
      } catch (e) {
        console.warn("[coach] invest-context failed", e);
      }
    }

    const planContext = plan
      ? `User's homebuying plan answers (use these as context):\nPlan: ${plan.title ?? "Untitled plan"}\n${JSON.stringify(plan.answers, null, 2)}`
      : "The user has not yet completed their homebuying plan questionnaire.";

    const summaryBlock = rollingSummary
      ? `\n\nEarlier conversation summary (older turns folded for brevity):\n${rollingSummary}`
      : "";

    const systemPrompt = `You are Keystone Coach, a warm, practical homebuying coach for first-time buyers in the US. Be concise (2-4 short paragraphs max), specific, and actionable. Use the user's plan data to personalize advice. A core message of Keystone is that investing the down-payment savings (rather than parking them in a basic savings account) gets users to their goal months sooner — bring this up naturally when relevant. When you don't know something (e.g. exact current mortgage rates), say so and explain how to find out. Never give legal, tax, or specific investment advice — recommend a professional.\n\nAfter your reply, on a new line, output exactly one JSON object on its own line in the form:\n<<FOLLOWUPS>>{"chips":["short follow-up 1","short follow-up 2","short follow-up 3"]}<<END>>\nEach chip must be under 60 chars, written as the user (e.g. "Show me a stretch goal at $200/mo more"), and concretely actionable for this user.\n\n${planContext}${investContext}${summaryBlock}\n\nUser email: ${email ?? "unknown"}`;

    const messages: GatewayMessage[] = [
      { role: "system", content: systemPrompt },
      ...recentTurns.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: data.content },
    ];

    // Call gateway BEFORE persisting the user message — on failure we don't
    // want orphan rows that confuse the next render.
    const raw = await callGateway(apiKey, messages);

    // Parse out the trailing followups block.
    let reply = raw || "Sorry, I had trouble responding.";
    let chips: string[] = [];
    const match = raw.match(/<<FOLLOWUPS>>([\s\S]*?)<<END>>/);
    if (match) {
      reply = raw.replace(match[0], "").trim() || reply;
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
    }

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

    return { ok: true as const, reply, chips };
  });

export const clearCoachHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("coach_messages")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    // Wipe the rolling summary too so next conversation starts clean.
    await supabaseAdmin
      .from("profiles")
      .update({ coach_summary: null })
      .eq("user_id", context.userId);
    return { ok: true as const };
  });
