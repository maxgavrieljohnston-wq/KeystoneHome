
revoke execute on function public.create_plan_with_limit(text, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_plan_with_limit(text, uuid, jsonb, text) to service_role;
