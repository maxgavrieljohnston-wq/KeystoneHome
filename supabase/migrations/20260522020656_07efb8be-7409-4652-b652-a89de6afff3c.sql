ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS action_plan_progress jsonb NOT NULL DEFAULT '{"checked":[],"dismissed":[],"updatedAt":null}'::jsonb;