import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPaddleEnvironment } from "@/lib/paddle";

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
}

interface AuthUser {
  id: string;
  email?: string | null;
}

function planTitle(p: PlanRow): string {
  if (p.title) return p.title;
  const a = p.answers ?? {};
  const zip = (a.zipData as { city?: string } | undefined)?.city;
  return zip ? `Plan in ${zip}` : "Your homebuying plan";
}

function timelineNote(p: PlanRow): string {
  const a = p.answers ?? {};
  const years = typeof a.timelineYears === "number" ? a.timelineYears : null;
  if (!years) return "";
  const created = new Date(p.created_at).getTime();
  const elapsedMonths = Math.max(
    0,
    Math.round((Date.now() - created) / (1000 * 60 * 60 * 24 * 30.4)),
  );
  const totalMonths = years * 12;
  const remaining = Math.max(0, totalMonths - elapsedMonths);
  return `${elapsedMonths} mo elapsed · ${remaining} mo to your ${years}-yr target`;
}

function renderDigest(opts: {
  firstName: string | null;
  email: string;
  plans: PlanRow[];
}) {
  const greeting = opts.firstName ? `Hi ${opts.firstName},` : "Hi,";
  const planBlocks = opts.plans
    .map((p) => {
      const title = planTitle(p);
      const note = timelineNote(p);
      return `<tr><td style="padding:14px 16px;border-top:1px solid #e8e1d2">
  <div style="font-family:Georgia,serif;font-size:18px;color:#1a1a1a;margin-bottom:4px">${escapeHtml(title)}</div>
  ${note ? `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#6b6b6b;letter-spacing:0.04em">${escapeHtml(note)}</div>` : ""}
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
  </div></body></html>`;

  const planLines = opts.plans
    .map((p) => `• ${planTitle(p)}${timelineNote(p) ? ` — ${timelineNote(p)}` : ""}`)
    .join("\n");
  const text = `${greeting}\n\nA month closer to home. Your ${opts.plans.length === 1 ? "plan" : "plans"} this month:\n\n${planLines}\n\nUpdate your plans: ${SITE_URL}/dashboard`;

  return { html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
            // Pause reminders if they downgraded
            await supabaseAdmin
              .from("profiles")
              .update({ reminders_enabled: false, next_reminder_at: null })
              .eq("user_id", row.user_id);
            skipped++;
            continue;
          }

          // Look up user email
          let userEmail: string | null = null;
          try {
            const { data: u } = await supabaseAdmin
              .schema("auth" as never)
              .from("users" as never)
              .select("email")
              .eq("id", row.user_id)
              .maybeSingle();
            userEmail = ((u as AuthUser | null)?.email as string | null) ?? null;
          } catch (err) {
            console.warn("[reminders/dispatch] auth lookup failed", err);
          }
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

          // Pull this user's plans
          const { data: plans } = await supabaseAdmin
            .from("plans")
            .select("id, title, created_at, answers")
            .eq("user_id", row.user_id)
            .order("created_at", { ascending: false })
            .limit(10);
          if (!plans || plans.length === 0) {
            // Reschedule, no plans yet
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

          const firstName = (row.display_name ?? "").split(" ")[0] || null;
          const { html, text } = renderDigest({
            firstName,
            email: userEmail,
            plans: plans as PlanRow[],
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
