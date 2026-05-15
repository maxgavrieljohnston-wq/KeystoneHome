import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPaddleEnvironment } from "@/lib/paddle";
import { computePlanMetrics, computeGoalProgress } from "@/lib/plan-metrics";

const SITE_NAME = "Keystone";
const SENDER_DOMAIN = "notify.keystonehomeowners.com";
const FROM_DOMAIN = "keystonehomeowners.com";
const SITE_URL = "https://keystonehomeowners.com";
const CADENCE_DAYS = 30;
const BATCH = 100;

interface PlanRow {
  id: string;
  title: string | null;
  created_at: string;
  answers: Record<string, unknown>;
  assumptions: Record<string, number> | null;
  current_savings: number | null;
  target_move_in: string | null;
}

function planTitle(p: PlanRow): string {
  if (p.title) return p.title;
  const a = p.answers ?? {};
  const zip = (a.zipData as { city?: string } | undefined)?.city;
  return zip ? `Plan in ${zip}` : "Your homebuying plan";
}

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

interface PlanDigest {
  title: string;
  goalLine: string | null;
  paceLine: string | null;
  metaLine: string;
}

function buildPlanDigest(p: PlanRow): PlanDigest {
  const metrics = computePlanMetrics(p.answers ?? {}, p.assumptions ?? null);
  const goal = computeGoalProgress(metrics, p.current_savings, p.target_move_in);

  let goalLine: string | null = null;
  let paceLine: string | null = null;

  if (goal.hasGoal && metrics.cashToClose > 0) {
    goalLine = `${Math.round(goal.pctToGoal)}% to cash-to-close · ${fmtUsd(goal.remaining)} to go`;
    if (goal.monthsToGoal != null && goal.requiredMonthly != null) {
      if (goal.paceDeltaMonthly != null) {
        const ahead = goal.paceDeltaMonthly >= 0;
        paceLine = `${goal.monthsToGoal} mo to move-in · need ${fmtUsd(goal.requiredMonthly)}/mo · ${ahead ? `ahead by ${fmtUsd(goal.paceDeltaMonthly)}/mo` : `behind by ${fmtUsd(-goal.paceDeltaMonthly)}/mo`}`;
      } else {
        paceLine = `${goal.monthsToGoal} mo to move-in · need ${fmtUsd(goal.requiredMonthly)}/mo`;
      }
    }
  }

  const metaLine = `${metrics.verdict} · ${fmtUsd(metrics.totalHousing)}/mo housing · ${(metrics.mortgageRate * 100).toFixed(2)}% rate`;

  return { title: planTitle(p), goalLine, paceLine, metaLine };
}

function renderDigest(opts: {
  firstName: string | null;
  email: string;
  plans: PlanRow[];
  unsubscribeUrl: string;
}) {
  const greeting = opts.firstName ? `Hi ${opts.firstName},` : "Hi,";
  const digests = opts.plans.map(buildPlanDigest);

  const planBlocks = digests
    .map((d) => {
      return `<tr><td style="padding:14px 16px;border-top:1px solid #e8e1d2">
  <div style="font-family:Georgia,serif;font-size:18px;color:#1a1a1a;margin-bottom:4px">${escapeHtml(d.title)}</div>
  <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#6b6b6b;letter-spacing:0.04em;margin-bottom:4px">${escapeHtml(d.metaLine)}</div>
  ${d.goalLine ? `<div style="font-family:Georgia,serif;font-size:14px;color:#1a1a1a;margin-top:6px">${escapeHtml(d.goalLine)}</div>` : ""}
  ${d.paceLine ? `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#c4452d;letter-spacing:0.04em;margin-top:2px">${escapeHtml(d.paceLine)}</div>` : ""}
</td></tr>`;
    })
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Georgia,serif;color:#1a1a1a">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#c4452d;margin-bottom:18px">— Your monthly check-in</div>
    <h1 style="font-weight:400;font-size:30px;line-height:1.1;letter-spacing:-0.02em;margin:0 0 14px">A month closer to home.</h1>
    <p style="margin:0 0 20px;color:#3d3d3d;font-size:16px;line-height:1.55">${greeting} here's where your ${opts.plans.length === 1 ? "plan stands" : `${opts.plans.length} plans stand`} this month.</p>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-bottom:1px solid #e8e1d2;margin:8px 0 24px">${planBlocks}</table>
    <p style="margin:0 0 24px;color:#3d3d3d;font-size:14px;line-height:1.55">Numbers change — incomes shift, rates move, you save more. Re-run any plan to see the updated math.</p>
    <p style="margin:24px 0 0">
      <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#1a1a1a;color:#f5efe6;padding:14px 22px;border-radius:8px;text-decoration:none;font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:0.12em;text-transform:uppercase">Update your plans</a>
    </p>
    <p style="margin:32px 0 0;color:#a39888;font-size:12px;line-height:1.5">Keystone — your path to homeownership.</p>
    <p style="margin:18px 0 0;color:#a39888;font-size:11px;line-height:1.5">
      Don't want monthly check-ins? <a href="${opts.unsubscribeUrl}" style="color:#a39888;text-decoration:underline">Unsubscribe</a>.
    </p>
  </div></body></html>`;

  const planLines = digests
    .map((d) =>
      [`• ${d.title}`, `  ${d.metaLine}`, d.goalLine ? `  ${d.goalLine}` : null, d.paceLine ? `  ${d.paceLine}` : null]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
  const text = `${greeting}\n\nA month closer to home. Your ${opts.plans.length === 1 ? "plan" : "plans"} this month:\n\n${planLines}\n\nUpdate your plans: ${SITE_URL}/dashboard\n\nUnsubscribe: ${opts.unsubscribeUrl}`;

  return { html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function getOrMintUnsubscribeToken(email: string): Promise<string> {
  const lower = email.toLowerCase();
  const { data: existing } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", lower)
    .is("used_at", null)
    .maybeSingle();
  if (existing?.token) return existing.token as string;

  // Mint new token
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const { error } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .insert({ email: lower, token });
  if (error) {
    // Race or constraint — re-query
    const { data: retry } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", lower)
      .is("used_at", null)
      .maybeSingle();
    if (retry?.token) return retry.token as string;
    throw new Error(error.message);
  }
  return token;
}

async function lookupUserEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) {
      console.warn("[reminders/dispatch] auth.getUserById failed", error.message);
      return null;
    }
    return data.user?.email ?? null;
  } catch (err) {
    console.warn("[reminders/dispatch] auth lookup threw", err);
    return null;
  }
}

export const Route = createFileRoute("/api/public/reminders/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require service role bearer token (cron-only endpoint)
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const authHeader = request.headers.get("Authorization");
        if (
          !supabaseServiceKey ||
          !authHeader?.startsWith("Bearer ") ||
          authHeader.slice("Bearer ".length).trim() !== supabaseServiceKey
        ) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        const env = getPaddleEnvironment();
        const now = new Date().toISOString();

        // Find profiles with reminders due
        const { data: due, error: dueErr } = await supabaseAdmin
          .from("profiles")
          .select("user_id, display_name, reminders_enabled, next_reminder_at")
          .eq("reminders_enabled", true)
          .lte("next_reminder_at", now)
          .limit(BATCH);

        if (dueErr) {
          console.error("[reminders/dispatch] profiles query failed", dueErr);
          return new Response(JSON.stringify({ ok: false, error: dueErr.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        if (!due || due.length === 0) {
          return Response.json({ ok: true, processed: 0 });
        }

        let sent = 0;
        let skipped = 0;

        for (const row of due as Array<{ user_id: string; display_name: string | null; next_reminder_at: string | null }>) {
          // Re-verify entitlement
          const { data: stillPaid } = await supabaseAdmin.rpc("has_active_subscription", {
            user_uuid: row.user_id,
            check_env: env,
          });
          if (!stillPaid) {
            await supabaseAdmin
              .from("profiles")
              .update({ reminders_enabled: false, next_reminder_at: null })
              .eq("user_id", row.user_id);
            skipped++;
            continue;
          }

          const userEmail = await lookupUserEmail(row.user_id);
          if (!userEmail) {
            skipped++;
            continue;
          }

          // Check suppression
          const { data: suppressed } = await supabaseAdmin
            .from("suppressed_emails")
            .select("email")
            .eq("email", userEmail.toLowerCase())
            .maybeSingle();
          if (suppressed) {
            await supabaseAdmin
              .from("profiles")
              .update({ reminders_enabled: false, next_reminder_at: null })
              .eq("user_id", row.user_id);
            skipped++;
            continue;
          }

          // Pull this user's plans (with goal data + assumptions)
          const { data: plans } = await supabaseAdmin
            .from("plans")
            .select("id, title, created_at, answers, assumptions, current_savings, target_move_in")
            .eq("user_id", row.user_id)
            .order("created_at", { ascending: false })
            .limit(10);
          if (!plans || plans.length === 0) {
            await supabaseAdmin
              .from("profiles")
              .update({
                next_reminder_at: new Date(
                  Date.now() + CADENCE_DAYS * 24 * 60 * 60 * 1000,
                ).toISOString(),
              })
              .eq("user_id", row.user_id);
            skipped++;
            continue;
          }

          // Mint or reuse unsubscribe token
          let unsubscribeToken: string;
          try {
            unsubscribeToken = await getOrMintUnsubscribeToken(userEmail);
          } catch (err) {
            console.error("[reminders/dispatch] unsubscribe token failed", err);
            skipped++;
            continue;
          }
          const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

          const firstName = (row.display_name ?? "").split(" ")[0] || null;
          const { html, text } = renderDigest({
            firstName,
            email: userEmail,
            plans: plans as PlanRow[],
            unsubscribeUrl,
          });

          const messageId = `reminder-${row.user_id}-${new Date().toISOString().slice(0, 10)}`;

          await supabaseAdmin.from("email_send_log").insert({
            message_id: messageId,
            template_name: "plan_reminder",
            recipient_email: userEmail,
            status: "pending",
          });

          const { error: enqueueErr } = await supabaseAdmin.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              message_id: messageId,
              to: userEmail,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject: `Your ${SITE_NAME} monthly check-in`,
              html,
              text,
              purpose: "transactional",
              label: "plan_reminder",
              unsubscribe_token: unsubscribeToken,
              queued_at: new Date().toISOString(),
            } as never,
          });
          if (enqueueErr) {
            console.error("[reminders/dispatch] enqueue failed", enqueueErr);
            skipped++;
            continue;
          }

          // Advance schedule
          await supabaseAdmin
            .from("profiles")
            .update({
              last_reminder_at: new Date().toISOString(),
              next_reminder_at: new Date(
                Date.now() + CADENCE_DAYS * 24 * 60 * 60 * 1000,
              ).toISOString(),
            })
            .eq("user_id", row.user_id);

          sent++;
        }

        return Response.json({ ok: true, processed: due.length, sent, skipped });
      },
    },
  },
});
