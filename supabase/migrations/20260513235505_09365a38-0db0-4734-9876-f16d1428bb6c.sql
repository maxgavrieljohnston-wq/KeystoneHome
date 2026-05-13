ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_reminders_due_idx
  ON public.profiles (next_reminder_at)
  WHERE reminders_enabled = true;