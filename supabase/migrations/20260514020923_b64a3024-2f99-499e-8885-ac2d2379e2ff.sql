
-- Profiles: restrict SELECT to own profile
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Plans: drop public shared-plan SELECT policy; shares go through server fn
DROP POLICY IF EXISTS "Anyone can view shared plans" ON public.plans;

-- Fix mutable search_path on trigger function
CREATE OR REPLACE FUNCTION public.touch_rate_alerts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
