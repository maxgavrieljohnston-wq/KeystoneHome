import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, claims } = context;
    const email = (claims.email as string | undefined)?.toLowerCase();

    if (!email) {
      return { email: null, lead: null as null };
    }

    const { data, error } = await supabase
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
