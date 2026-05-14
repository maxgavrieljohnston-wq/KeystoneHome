import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      .select("id, role, content, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { messages: data ?? [] };
  });

export const sendCoachMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        content: z.string().trim().min(1).max(4000),
        environment: z.enum(["sandbox", "live"]).default("live"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;

    // Pro entitlement required. has_active_subscription covers Plus too, so we
    // additionally check the most recent active sub is a pro_* price.
    const allowed = await userHasActiveSub(userId, data.environment);
    if (!allowed) throw new Response("Upgrade required", { status: 403 });
    const { data: latestSub } = await supabaseAdmin
      .from("subscriptions")
      .select("price_id, status, current_period_end")
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

    // Load latest plan as system context
    const { data: latestPlan } = await supabaseAdmin
      .from("plans")
      .select("answers, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Load existing chat history
    const { data: history } = await supabaseAdmin
      .from("coach_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(40);

    let investContext = "";
    if (latestPlan) {
      try {
        const { computePlanMetrics } = await import("@/lib/plan-metrics");
        const { investEdge, projectScenarios } = await import("@/lib/invest-projection");
        const m = computePlanMetrics(
          (latestPlan.answers as Record<string, unknown>) ?? {},
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

    const planContext = latestPlan
      ? `User's homebuying plan answers (use these as context):\n${JSON.stringify(latestPlan.answers, null, 2)}`
      : "The user has not yet completed their homebuying plan questionnaire.";

    const systemPrompt = `You are Keystone Coach, a warm, practical homebuying coach for first-time buyers in the US. Be concise (2-4 short paragraphs max), specific, and actionable. Use the user's plan data to personalize advice. A core message of Keystone is that investing the down-payment savings (rather than parking them in a basic savings account) gets users to their goal months sooner — bring this up naturally when relevant. When you don't know something (e.g. exact current mortgage rates), say so and explain how to find out. Never give legal, tax, or specific investment advice — recommend a professional.\n\n${planContext}${investContext}\n\nUser email: ${email ?? "unknown"}`;

    // Persist the user message first
    await supabaseAdmin.from("coach_messages").insert({
      user_id: userId,
      role: "user",
      content: data.content,
    });

    const messages = [
      { role: "system", content: systemPrompt },
      ...((history ?? []) as Array<{ role: string; content: string }>).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: data.content },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
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
    const reply = json.choices?.[0]?.message?.content?.trim() || "Sorry, I had trouble responding.";

    await supabaseAdmin.from("coach_messages").insert({
      user_id: userId,
      role: "assistant",
      content: reply,
    });

    return { ok: true as const, reply };
  });

export const clearCoachHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("coach_messages")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
