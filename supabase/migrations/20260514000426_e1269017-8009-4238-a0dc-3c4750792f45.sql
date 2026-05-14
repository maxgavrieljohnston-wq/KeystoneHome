
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS parent_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS share_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS share_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS target_move_in date,
  ADD COLUMN IF NOT EXISTS current_savings numeric,
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark','sepia'));

CREATE INDEX IF NOT EXISTS idx_plans_parent ON public.plans(parent_plan_id);
CREATE INDEX IF NOT EXISTS idx_plans_share ON public.plans(share_slug) WHERE share_enabled = true;
CREATE INDEX IF NOT EXISTS idx_plans_tags ON public.plans USING GIN(tags);

CREATE POLICY "Anyone can view shared plans"
  ON public.plans
  FOR SELECT
  USING (share_enabled = true AND share_slug IS NOT NULL);
