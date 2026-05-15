ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coach_summary text;
ALTER TABLE public.coach_messages ADD COLUMN IF NOT EXISTS meta jsonb;