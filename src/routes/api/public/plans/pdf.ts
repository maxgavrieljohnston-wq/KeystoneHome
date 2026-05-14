import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildPlanPdfBytes } from "@/lib/plan-pdf.server";

export const Route = createFileRoute("/api/public/plans/pdf")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token || token.length < 8 || token.length > 64 || !/^[A-Za-z0-9_-]+$/.test(token)) {
          return new Response("Invalid token", { status: 400 });
        }

        const { data: plan, error } = await supabaseAdmin
          .from("plans")
          .select("id, email, title, answers, created_at")
          .eq("pdf_token" as never, token)
          .maybeSingle();
        if (error || !plan) return new Response("Not found", { status: 404 });

        const { bytes, filename } = await buildPlanPdfBytes({
          id: (plan as { id: string }).id,
          email: (plan as { email: string }).email,
          title: (plan as { title: string | null }).title,
          answers: ((plan as { answers: Record<string, unknown> | null }).answers ?? {}) as Record<string, unknown>,
          created_at: (plan as { created_at: string | null }).created_at,
        });

        return new Response(bytes as unknown as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${filename}"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
