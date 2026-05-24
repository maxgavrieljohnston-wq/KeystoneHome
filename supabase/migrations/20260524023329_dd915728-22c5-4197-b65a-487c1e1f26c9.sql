-- Timestamp helper (idempotent)
CREATE OR REPLACE FUNCTION public.coach_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. coach_threads
CREATE TABLE public.coach_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid,
  title text NOT NULL DEFAULT 'New conversation',
  summary text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_threads_user ON public.coach_threads(user_id, archived, updated_at DESC);
CREATE INDEX idx_coach_threads_plan ON public.coach_threads(plan_id) WHERE plan_id IS NOT NULL;

ALTER TABLE public.coach_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages coach threads"
  ON public.coach_threads FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users read own coach threads"
  ON public.coach_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own coach threads"
  ON public.coach_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own coach threads"
  ON public.coach_threads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own coach threads"
  ON public.coach_threads FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER coach_threads_set_updated_at
  BEFORE UPDATE ON public.coach_threads
  FOR EACH ROW EXECUTE FUNCTION public.coach_set_updated_at();

-- 2. coach_messages.thread_id + backfill
ALTER TABLE public.coach_messages
  ADD COLUMN thread_id uuid;

WITH new_threads AS (
  INSERT INTO public.coach_threads (user_id, title, summary, created_at, updated_at)
  SELECT
    cm.user_id,
    'Conversation',
    p.coach_summary,
    MIN(cm.created_at),
    MAX(cm.created_at)
  FROM public.coach_messages cm
  LEFT JOIN public.profiles p ON p.user_id = cm.user_id
  GROUP BY cm.user_id, p.coach_summary
  RETURNING id, user_id
)
UPDATE public.coach_messages cm
SET thread_id = nt.id
FROM new_threads nt
WHERE cm.user_id = nt.user_id
  AND cm.thread_id IS NULL;

ALTER TABLE public.coach_messages
  ALTER COLUMN thread_id SET NOT NULL;

ALTER TABLE public.coach_messages
  ADD CONSTRAINT coach_messages_thread_id_fkey
  FOREIGN KEY (thread_id) REFERENCES public.coach_threads(id) ON DELETE CASCADE;

CREATE INDEX idx_coach_messages_thread ON public.coach_messages(thread_id, created_at);

-- 3. coach_message_actions
CREATE TABLE public.coach_message_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.coach_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'proposed',
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  CONSTRAINT coach_message_actions_status_chk
    CHECK (status IN ('proposed', 'applied', 'dismissed'))
);

CREATE INDEX idx_coach_message_actions_message ON public.coach_message_actions(message_id);
CREATE INDEX idx_coach_message_actions_user ON public.coach_message_actions(user_id, status);

ALTER TABLE public.coach_message_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages coach message actions"
  ON public.coach_message_actions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users read own coach message actions"
  ON public.coach_message_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own coach message actions"
  ON public.coach_message_actions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own coach message actions"
  ON public.coach_message_actions FOR DELETE
  USING (auth.uid() = user_id);