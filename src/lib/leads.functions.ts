import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  answers: z.record(z.string(), z.unknown()).default({}),
  completed: z.boolean().default(false),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

export const upsertLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.rpc("upsert_lead", {
      p_email: data.email,
      p_answers: data.answers as never,
      p_completed: data.completed,
      p_first_name: data.firstName || null,
      p_last_name: data.lastName || null,
      p_phone: data.phone || null,
    });
    if (error) {
      console.error("[upsertLead] failed", error);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });
