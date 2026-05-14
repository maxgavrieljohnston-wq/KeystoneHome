import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { claims } = context;
    const email = (claims.email as string | undefined)?.toLowerCase();

    if (!email) {
      return { email: null, lead: null as null };
    }

    // leads table has RLS on but no client policies by design; read via admin
    // client, scoped to the authenticated user's own email.
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("email, completed, answers, updated_at, first_name, last_name, phone")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("[getMyPlan] failed", error);
      return { email, lead: null as null };
    }

    return { email, lead: data };
  });
