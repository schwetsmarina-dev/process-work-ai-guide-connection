import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17';

/**
 * Stripe webhook — the ONLY place where a paid entitlement is created.
 *
 * Environment:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET   whsec_... from the Stripe dashboard
 *
 * Things that are easy to get wrong and are handled here:
 *
 * • Signature verification. Without it, anyone who knows the URL can post a
 *   fake "payment succeeded" and grant themselves access. The raw body must be
 *   read as text BEFORE parsing, or the signature will never match.
 * • No authentication check. Stripe is not a logged-in user; the signature is
 *   the authentication. This endpoint must stay public.
 * • Idempotency. Stripe retries. Entitlements are looked up by subscription id
 *   and updated rather than duplicated.
 * • Lifetime grants are never touched. A founding tester who also subscribes
 *   keeps both rows; getEntitlement picks the best one.
 * • Always answer 200 once the signature is valid, even on internal errors —
 *   a 500 makes Stripe retry the same event for days.
 */
Deno.serve(async (req) => {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!secretKey || !webhookSecret) {
    console.error('[stripeWebhook] missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return Response.json({ error: 'Not configured' }, { status: 500 });
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });

  // Raw body first — parsing it would break signature verification.
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[stripeWebhook] signature verification failed:', err?.message);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole.entities.Entitlement;

    /** Create or update the paid entitlement for one subscription. */
    async function upsertPaid({ email, subscriptionId, customerId, status, currentPeriodEnd }) {
      if (!email) {
        console.warn('[stripeWebhook] event without user_email, skipping', subscriptionId);
        return;
      }

      // Stripe statuses → our own. Anything not clearly good loses access.
      const active = status === 'active' || status === 'trialing';
      const mapped =
        status === 'past_due' || status === 'unpaid'
          ? 'past_due'
          : active
            ? 'active'
            : 'canceled';

      const payload = {
        user_email: String(email).toLowerCase(),
        plan: 'paid',
        status: mapped,
        // Access runs to the end of the paid period, not to the cancellation
        // date: someone who cancels keeps what they already paid for.
        expires_at: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
        source: 'stripe',
        stripe_customer_id: customerId || '',
        stripe_subscription_id: subscriptionId || '',
        note: '',
        granted_by: '',
      };

      const existing = subscriptionId
        ? await svc.filter({ stripe_subscription_id: subscriptionId })
        : [];

      if (existing && existing.length > 0) {
        await svc.update(existing[0].id, payload);
        console.log('[stripeWebhook] updated entitlement', { email, subscriptionId, status: mapped });
      } else {
        await svc.create(payload);
        console.log('[stripeWebhook] created entitlement', { email, subscriptionId, status: mapped });
      }
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;
        const subscriptionId = session.subscription;
        let sub = null;
        if (subscriptionId) {
          sub = await stripe.subscriptions.retrieve(subscriptionId);
        }
        await upsertPaid({
          email: session.client_reference_id || session.metadata?.user_email || session.customer_email,
          subscriptionId,
          customerId: session.customer,
          status: sub?.status || 'active',
          currentPeriodEnd: sub?.current_period_end,
        });
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        let email = sub.metadata?.user_email;
        if (!email && sub.customer) {
          const customer = await stripe.customers.retrieve(sub.customer);
          email = customer?.email;
        }
        await upsertPaid({
          email,
          subscriptionId: sub.id,
          customerId: sub.customer,
          status: event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status,
          currentPeriodEnd: sub.current_period_end,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const rows = await svc.filter({ stripe_subscription_id: invoice.subscription });
          if (rows?.[0]) {
            await svc.update(rows[0].id, { status: 'past_due' });
            console.log('[stripeWebhook] marked past_due', invoice.subscription);
          }
        }
        break;
      }

      default:
        // Unhandled events are fine; acknowledge so Stripe stops retrying.
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    // Signature was valid, so this is our bug, not a forged request. Log it
    // loudly but return 200 — otherwise Stripe retries for days and the log
    // fills with the same failure.
    console.error('[stripeWebhook] handler error:', event?.type, error?.message, String(error));
    return Response.json({ received: true, handlerError: true });
  }
});
