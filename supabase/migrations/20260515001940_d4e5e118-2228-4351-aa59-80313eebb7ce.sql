-- Mirror johnstonsmagnolias@gmail.com's sandbox Pro entitlement to live
-- so the published app (which queries environment='live') unlocks Pro features.
insert into public.subscriptions (
  user_id, paddle_subscription_id, paddle_customer_id,
  product_id, price_id, status,
  current_period_start, current_period_end, environment
)
select
  user_id,
  paddle_subscription_id || '_live_mirror',
  paddle_customer_id,
  product_id, price_id, status,
  current_period_start, current_period_end,
  'live'
from public.subscriptions
where user_id = '1ee83a8e-94b3-474e-bbef-71b4135e52ea'
  and environment = 'sandbox'
  and price_id = 'pro_yearly'
  and status = 'active'
on conflict (paddle_subscription_id) do nothing;

-- Same for the secondary tester account.
insert into public.subscriptions (
  user_id, paddle_subscription_id, paddle_customer_id,
  product_id, price_id, status,
  current_period_start, current_period_end, environment
)
select
  user_id,
  paddle_subscription_id || '_live_mirror',
  paddle_customer_id,
  product_id, price_id, status,
  current_period_start, current_period_end,
  'live'
from public.subscriptions
where user_id = '019f5db0-11ae-4766-9701-658665d43417'
  and environment = 'sandbox'
  and price_id = 'pro_yearly'
  and status = 'active'
on conflict (paddle_subscription_id) do nothing;

-- Claim orphan plans for these users by email.
update public.plans p
set user_id = u.id
from auth.users u
where p.user_id is null
  and lower(p.email) = lower(u.email)
  and lower(u.email) in ('johnstonsmagnolias@gmail.com','max.gavriel.johnston@gmail.com');
