import { createFileRoute, useSearch } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkFaint: "#a39888",
  ember: "#c4452d",
  rule: "#e8e1d2",
};

const lookupUnsubscribe = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(8).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("email, used_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false as const, reason: "invalid" as const };
    return {
      ok: true as const,
      email: row.email as string,
      alreadyUsed: !!row.used_at,
    };
  });

const confirmUnsubscribe = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(8).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("email, used_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false as const, reason: "invalid" as const };

    const email = (row.email as string).toLowerCase();

    // Mark token used (idempotent)
    await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", data.token);

    // Insert suppression (ignore dupes via try/catch)
    const { error: supErr } = await supabaseAdmin
      .from("suppressed_emails")
      .insert({ email, reason: "unsubscribe" });
    if (supErr && !String(supErr.message).toLowerCase().includes("duplicate")) {
      // continue regardless — best-effort
      console.warn("[unsubscribe] suppression insert", supErr.message);
    }

    // Pause reminders for any matching profile
    const { data: users } = await supabaseAdmin
      .schema("auth" as never)
      .from("users" as never)
      .select("id")
      .eq("email", email)
      .maybeSingle();
    const userId = (users as { id?: string } | null)?.id;
    if (userId) {
      await supabaseAdmin
        .from("profiles")
        .update({ reminders_enabled: false, next_reminder_at: null })
        .eq("user_id", userId);
    }

    return { ok: true as const, email };
  });

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search) => searchSchema.parse(search),
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: "Unsubscribe — Keystone" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const lookup = useServerFn(lookupUnsubscribe);
  const confirm = useServerFn(confirmUnsubscribe);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["unsub", token],
    queryFn: () => lookup({ data: { token: token! } }),
    enabled: !!token,
  });

  const m = useMutation({
    mutationFn: () => confirm({ data: { token: token! } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unsub", token] }),
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.paper,
        color: C.ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Georgia, serif",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "#fff",
          border: `1px solid ${C.rule}`,
          borderRadius: 12,
          padding: "32px 28px",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.ember,
            marginBottom: 14,
          }}
        >
          — Email preferences
        </div>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 30,
            fontWeight: 400,
            margin: "0 0 14px",
            letterSpacing: "-0.01em",
          }}
        >
          Unsubscribe from Keystone emails
        </h1>

        {!token && (
          <p style={{ color: "#3d3d3d", lineHeight: 1.55 }}>
            Missing token. Please use the link from your email.
          </p>
        )}

        {token && q.isLoading && <p style={{ color: C.inkFaint }}>Loading…</p>}

        {q.data && q.data.ok === false && (
          <p style={{ color: "#3d3d3d" }}>
            That link isn't valid. It may have already been used or expired.
          </p>
        )}

        {q.data && q.data.ok && q.data.alreadyUsed && (
          <p style={{ color: "#3d3d3d" }}>
            <strong>{q.data.email}</strong> is already unsubscribed. You won't
            receive further reminders.
          </p>
        )}

        {q.data && q.data.ok && !q.data.alreadyUsed && !m.data && (
          <>
            <p style={{ color: "#3d3d3d", lineHeight: 1.55, marginBottom: 22 }}>
              Confirm to stop sending plan reminders to{" "}
              <strong>{q.data.email}</strong>.
            </p>
            <button
              type="button"
              onClick={() => m.mutate()}
              disabled={m.isPending}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                padding: "12px 20px",
                background: C.ink,
                color: C.paper,
                border: "none",
                borderRadius: 8,
                cursor: m.isPending ? "default" : "pointer",
                opacity: m.isPending ? 0.6 : 1,
              }}
            >
              {m.isPending ? "Unsubscribing…" : "Confirm unsubscribe"}
            </button>
          </>
        )}

        {m.data?.ok && (
          <p style={{ color: "#3d3d3d", lineHeight: 1.55 }}>
            Done. <strong>{m.data.email}</strong> won't receive any more
            Keystone emails.
          </p>
        )}
      </div>
    </main>
  );
}
