import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { buildPlanPdfBytes } from "@/lib/plan-pdf.server";


const submitSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  answers: z.record(z.string(), z.unknown()).default({}),
  environment: z.enum(["sandbox", "live"]).default("live"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

async function lookupUserIdByEmail(email: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .schema("auth" as never)
      .from("users" as never)
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (error) {
      console.warn("[lookupUserIdByEmail]", error);
      return null;
    }
    return (data as { id?: string } | null)?.id ?? null;
  } catch (err) {
    console.warn("[lookupUserIdByEmail] threw", err);
    return null;
  }
}

export const submitPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    const userId = await lookupUserIdByEmail(data.email);

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      "create_plan_with_limit",
      {
        p_email: data.email,
        p_user_id: (userId ?? null) as never,
        p_answers: data.answers as never,
        p_environment: data.environment,
        p_first_name: data.firstName || null,
        p_last_name: data.lastName || null,
        p_phone: data.phone || null,
      },
    );

    if (rpcError) {
      console.error("[submitPlan] rpc failed", rpcError);
      return { ok: false as const, reason: "server_error" as const };
    }

    const result = rpcResult as unknown as {
      ok: boolean;
      reason?: string;
      plan_id?: string;
      used?: number;
      limit?: number | null;
      is_paid?: boolean;
    };

    if (!result.ok) {
      return {
        ok: false as const,
        reason: (result.reason ?? "unknown") as
          | "limit_reached"
          | "invalid_email"
          | "server_error"
          | "unknown",
        used: result.used ?? null,
        limit: result.limit ?? null,
      };
    }

    // PDF download is a Plus/Pro feature; do not email a PDF link to free users.
    // Plan summary email is intentionally not sent on submit anymore.

    return {
      ok: true as const,
      planId: result.plan_id ?? null,
      used: result.used ?? null,
      limit: result.limit ?? null,
      isPaid: Boolean(result.is_paid),
    };
  });

export const getMyPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims.email as string | undefined)?.toLowerCase();

    const PLAN_COLS = "id, email, title, answers, created_at, tags, notes, share_slug, share_enabled, assumptions, target_move_in, current_savings, theme, parent_plan_id, version";
    const { data: ownedPlans } = await supabase
      .from("plans")
      .select(PLAN_COLS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    type PlanRow = NonNullable<typeof ownedPlans>[number];
    let orphanPlans: PlanRow[] = [];
    if (email) {
      const { data } = await supabaseAdmin
        .from("plans")
        .select(PLAN_COLS)
        .ilike("email", email)
        .is("user_id", null)
        .order("created_at", { ascending: false });
      orphanPlans = (data ?? []) as PlanRow[];

      if (orphanPlans.length > 0) {
        await supabaseAdmin
          .from("plans")
          .update({ user_id: userId })
          .ilike("email", email)
          .is("user_id", null);
      }
    }

    const merged = [...(ownedPlans ?? []), ...orphanPlans].sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    );
    return { plans: merged, email: email ?? null };
  });

const planIdSchema = z.object({ planId: z.string().uuid() });

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

export const renamePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ planId: z.string().uuid(), title: z.string().trim().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("plans")
      .update({ title: data.title })
      .eq("id", data.planId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => planIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("plans")
      .delete()
      .eq("id", data.planId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const duplicatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => planIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: src, error: srcErr } = await supabaseAdmin
      .from("plans")
      .select("id, email, title, answers, tags, notes, assumptions, target_move_in, current_savings, theme, parent_plan_id, version")
      .eq("id", data.planId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (srcErr) throw new Error(srcErr.message);
    if (!src) throw new Response("Not found", { status: 404 });

    const rootId = src.parent_plan_id ?? src.id;

    const { data: family } = await supabaseAdmin
      .from("plans")
      .select("version")
      .or(`id.eq.${rootId},parent_plan_id.eq.${rootId}`)
      .eq("user_id", context.userId);
    const maxVersion = (family ?? []).reduce(
      (m: number, r: { version: number | null }) => Math.max(m, r.version ?? 1),
      1,
    );

    const { data: created, error: insErr } = await supabaseAdmin
      .from("plans")
      .insert({
        email: src.email,
        user_id: context.userId,
        answers: src.answers,
        title: src.title,
        tags: src.tags ?? [],
        notes: src.notes,
        assumptions: src.assumptions ?? {},
        target_move_in: src.target_move_in,
        current_savings: src.current_savings,
        theme: src.theme ?? "light",
        parent_plan_id: rootId,
        version: maxVersion + 1,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    return { ok: true as const, planId: created.id };
  });

export const exportPlanPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        environment: z.enum(["sandbox", "live"]).default("live"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify entitlement (Plus or Pro)
    const allowed = await userHasActiveSub(context.userId, data.environment);
    if (!allowed) {
      throw new Response("Upgrade required", { status: 403 });
    }

    const { data: plan, error } = await supabaseAdmin
      .from("plans")
      .select("id, email, title, answers, assumptions, theme, created_at, target_move_in, current_savings")
      .eq("id", data.planId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Response("Not found", { status: 404 });

    const { bytes, filename } = await buildPlanPdfBytes({
      id: plan.id as string,
      email: plan.email as string,
      title: plan.title as string | null,
      answers: (plan.answers ?? {}) as Record<string, unknown>,
      assumptions: (plan.assumptions ?? null) as Record<string, number> | null,
      theme: (plan.theme ?? null) as import("@/lib/plan-themes").PlanThemeId | null,
      created_at: plan.created_at as string | null,
      target_move_in: (plan.target_move_in ?? null) as string | null,
      current_savings: (plan.current_savings ?? null) as number | null,
    });
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    return { ok: true as const, base64, filename };
  });


// ── Plus tier feature server functions ────────────────────────────────────

const assumptionsSchema = z.object({
  propertyTaxPct: z.number().min(0).max(10).optional(),
  insuranceAnnual: z.number().min(0).max(50000).optional(),
  hoaMonthly: z.number().min(0).max(5000).optional(),
  mortgageRatePct: z.number().min(0).max(20).optional(),
  pmiPct: z.number().min(0).max(5).optional(),
  expectedReturnPct: z.number().min(0).max(30).optional(),
  closingCostPct: z.number().min(0).max(10).optional(),
  movingCost: z.number().min(0).max(50000).optional(),
  investMonthly: z.number().min(0).max(100000).optional(),
}).strict();

const updateMetaSchema = z.object({
  planId: z.string().uuid(),
  title: z.string().trim().min(1).max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  notes: z.string().max(2000).nullable().optional(),
  theme: z.enum(["light", "dark", "sepia", "navy", "terracotta"]).optional(),
  targetMoveIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  currentSavings: z.number().min(0).max(1e9).nullable().optional(),
  assumptions: assumptionsSchema.optional(),
  environment: z.enum(["sandbox", "live"]).default("live"),
});

export const updatePlanMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateMetaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const allowed = await userHasActiveSub(context.userId, data.environment);
    if (!allowed) throw new Response("Upgrade required", { status: 403 });

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.tags !== undefined) patch.tags = data.tags;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.theme !== undefined) patch.theme = data.theme;
    if (data.targetMoveIn !== undefined) patch.target_move_in = data.targetMoveIn;
    if (data.currentSavings !== undefined) patch.current_savings = data.currentSavings;
    if (data.assumptions !== undefined) patch.assumptions = data.assumptions;

    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { error } = await supabaseAdmin
      .from("plans")
      .update(patch as never)
      .eq("id", data.planId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const togglePlanShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      planId: z.string().uuid(),
      enabled: z.boolean(),
      environment: z.enum(["sandbox", "live"]).default("live"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const allowed = await userHasActiveSub(context.userId, data.environment);
    if (!allowed) throw new Response("Upgrade required", { status: 403 });

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("plans")
      .select("share_slug")
      .eq("id", data.planId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing) throw new Response("Not found", { status: 404 });

    let slug = (existing as { share_slug: string | null }).share_slug;
    if (data.enabled && !slug) {
      const { nanoid } = await import("nanoid");
      slug = nanoid(10);
    }

    const { error } = await supabaseAdmin
      .from("plans")
      .update({ share_enabled: data.enabled, share_slug: slug })
      .eq("id", data.planId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, slug: data.enabled ? slug : null };
  });

export const getSharedPlan = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(4).max(40) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: plan, error } = await supabaseAdmin
      .from("plans")
      .select("id, title, answers, created_at, theme, assumptions, target_move_in, current_savings, share_enabled")
      .eq("share_slug", data.slug)
      .eq("share_enabled", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Response("Not found", { status: 404 });
    return { plan };
  });

export const exportPlanCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      planId: z.string().uuid(),
      environment: z.enum(["sandbox", "live"]).default("live"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const allowed = await userHasActiveSub(context.userId, data.environment);
    if (!allowed) throw new Response("Upgrade required", { status: 403 });

    const { data: plan, error } = await supabaseAdmin
      .from("plans")
      .select("id, email, title, answers, created_at, assumptions, target_move_in, current_savings")
      .eq("id", data.planId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Response("Not found", { status: 404 });

    const { computePlanMetrics, computeGoalProgress } = await import("@/lib/plan-metrics");
    const { projectScenarios, futureValue, SCENARIOS } = await import("@/lib/invest-projection");

    const answers = (plan.answers ?? {}) as Record<string, unknown>;
    const assumptions = (plan.assumptions ?? null) as Record<string, number> | null;
    const m = computePlanMetrics(answers, assumptions);
    const targetMoveIn = (plan.target_move_in ?? null) as string | null;
    const currentSavings = (plan.current_savings ?? null) as number | null;
    const g = computeGoalProgress(m, currentSavings, targetMoveIn);

    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [];
    const section = (name: string) => { lines.push("", `## ${name}`); };
    const kv = (k: string, v: string | number) => lines.push(`${esc(k)},${esc(v)}`);
    const hdr = (...cols: string[]) => lines.push(cols.map(esc).join(","));
    const r = (n: number) => Math.round(n);

    // --- Provenance
    section("PLAN");
    kv("Plan ID", plan.id as string);
    kv("Title", (plan.title as string | null) || "Homebuying plan");
    kv("Generated", new Date().toISOString());
    kv("Created", (plan.created_at as string | null) || "");

    // --- Summary (matches dashboard / PDF)
    section("SUMMARY");
    kv("Location", `${m.city}${m.zip ? ` (${m.zip})` : ""}`);
    kv("Home style", m.homeStyleLabel);
    kv("Target price", r(m.targetPrice));
    kv("Down payment %", m.downPct);
    kv("Down payment $", r(m.downPayment));
    kv("Closing costs", r(m.closing));
    kv("Moving costs", r(m.moving));
    kv("TOTAL CASH TO CLOSE", r(m.cashToClose));
    kv("Mortgage rate %", +(m.mortgageRate * 100).toFixed(3));
    kv("Monthly P&I", r(m.monthlyMortgage));
    kv("Tax + insurance", r(m.taxIns));
    kv("PMI", r(m.pmi));
    kv("HOA", r(m.hoa));
    kv("Maintenance reserve", r(m.reserve));
    kv("TOTAL MONTHLY", r(m.totalHousing));
    kv("Housing-to-income %", +(m.housingRatio * 100).toFixed(1));
    kv("Verdict", m.verdict);
    kv("Readiness score", m.readiness);
    kv("Readiness label", m.readinessLabel);
    kv("Saved so far", r(m.saved));
    kv("Timeline (years)", m.timelineYears);
    kv("Save-only $/mo", m.monthlyToSave);
    kv(`Invested @ ${(m.expectedReturnRate * 100).toFixed(1)}% $/mo`, m.monthlyInvested);

    // --- Goal tracker
    section("GOAL");
    kv("Target move-in", targetMoveIn ?? "");
    kv("Current savings", currentSavings != null ? r(currentSavings) : "");
    kv("% to cash-to-close", +g.pctToGoal.toFixed(1));
    kv("Remaining", r(g.remaining));
    kv("Months to goal", g.monthsToGoal ?? "");
    kv("Required monthly to hit goal", g.requiredMonthly != null ? r(g.requiredMonthly) : "");
    kv("Stated monthly savings", r(g.statedMonthly));
    kv("Pace delta (stated − required)", g.paceDeltaMonthly != null ? r(g.paceDeltaMonthly) : "");

    // --- Raw inputs (re-importable)
    section("INPUTS");
    hdr("Field", "Value");
    for (const [k, v] of Object.entries(answers)) {
      const val = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
      kv(k, val);
    }

    // --- Assumption overrides
    section("ASSUMPTIONS");
    hdr("Field", "Value");
    if (assumptions) for (const [k, v] of Object.entries(assumptions)) kv(k, String(v));

    // --- Scenario comparison at chosen timeline
    section("SCENARIOS_AT_TIMELINE");
    hdr("Scenario", "Rate %", "Monthly $", "Total contributed", "Growth", "Months");
    const months = Math.max(1, Math.round(m.timelineYears * 12));
    const scenarios = projectScenarios({ saved: m.saved, target: m.downPayment, months });
    for (const s of scenarios) {
      lines.push([
        esc(s.scenario.label),
        esc(+(s.scenario.rate * 100).toFixed(2)),
        esc(s.monthly), esc(s.totalContributed), esc(s.growth), esc(s.months),
      ].join(","));
    }

    // --- Year-by-year projection at invested baseline
    section("YEAR_BY_YEAR_INVESTED");
    hdr("Year", "Contributed", "Growth", "Balance", "% of goal");
    const monthlyChosen = scenarios.find((s) => s.scenario.id === "invested")!.monthly;
    const investedRate = SCENARIOS.find((s) => s.id === "invested")!.rate;
    const totalYears = Math.max(1, Math.ceil(m.timelineYears));
    for (let yr = 1; yr <= totalYears; yr++) {
      const mm = yr * 12;
      const bal = futureValue(m.saved, monthlyChosen, investedRate, mm);
      const contrib = monthlyChosen * mm;
      const growth = Math.max(0, bal - m.saved - contrib);
      const pct = Math.min(100, +((bal / m.downPayment) * 100).toFixed(1));
      lines.push([yr, r(contrib), r(growth), r(bal), pct].join(","));
    }

    const csv = lines.join("\n").replace(/^\n/, "");
    const safeTitle = (plan.title || "keystone-plan").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return { ok: true as const, csv, filename: `${safeTitle}.csv` };
  });
