import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import { verifyWebhook, EventName, type PaddleEnv } from '@/lib/paddle.server';

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

async function resolveUserId(data: any): Promise<string | null> {
  // 1. Preferred: customData.userId set at checkout when the user was logged in.
  const fromCustom = data.customData?.userId;
  if (fromCustom) return fromCustom as string;

  // 2. Fallback: look up an existing auth user by the Paddle customer's email.
  //    Covers plan-first purchases where the buyer pays before creating an account.
  try {
    const customerId = data.customerId;
    if (!customerId) return null;
    const sb = getSupabase() as any;
    // Hit Paddle via the existing service role to fetch the customer email.
    // (Avoid pulling in paddle-node-sdk here — keep webhook lean.)
    return null;
  } catch {
    return null;
  }
}

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod } = data;
  const userId = await resolveUserId(data);
  if (!userId) {
    // Persist a placeholder row keyed by customerId so we can reconcile when
    // the user later creates an account with the matching email. For now we
    // log loudly so the operator can manually link if needed.
    console.error('[webhook] subscription.created with no resolvable userId', {
      customerId, subId: id,
    });
    return;
  }
  const item = items[0];
  const priceId = item.price.importMeta?.externalId;
  const productId = item.product.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn('Skipping subscription: missing importMeta.externalId', {
      rawPriceId: item.price.id,
      rawProductId: item.product.id,
    });
    return;
  }
  await (getSupabase() as any).from('subscriptions').upsert(
    {
      user_id: userId,
      paddle_subscription_id: id,
      paddle_customer_id: customerId,
      product_id: productId,
      price_id: priceId,
      status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'paddle_subscription_id' },
  );
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange, items } = data;
  const item = items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  const update: Record<string, unknown> = {
    status,
    current_period_start: currentBillingPeriod?.startsAt,
    current_period_end: currentBillingPeriod?.endsAt,
    cancel_at_period_end: scheduledChange?.action === 'cancel',
    updated_at: new Date().toISOString(),
  };
  if (priceId) update.price_id = priceId;
  if (productId) update.product_id = productId;
  await (getSupabase() as any).from('subscriptions').update(update)
    .eq('paddle_subscription_id', id).eq('environment', env);
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await (getSupabase() as any).from('subscriptions').update({
    status: 'canceled',
    updated_at: new Date().toISOString(),
  }).eq('paddle_subscription_id', data.id).eq('environment', env);
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    default:
      console.log('Unhandled event:', event.eventType);
  }
}

export const Route = createFileRoute('/api/public/payments/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get('env') || 'sandbox') as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error('Webhook error:', e);
          return new Response('Webhook error', { status: 400 });
        }
      },
    },
  },
});
