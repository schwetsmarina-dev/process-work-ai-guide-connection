import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17';

/**
 * Creates a Stripe Checkout session for the signed-in user.
 *
 * Environment:
 *   STRIPE_SECRET_KEY   sk_test_... while testing, sk_live_... in production
 *   STRIPE_PRICE_ID     the recurring price to sell
 *   APP_URL             e.g. https://pwguide.uwu.ai  (no trailing slash)
 *
 * Two decisions worth keeping:
 *
 * 1. The price comes from the environment, never from the request. If the
 *    client could name a price, it could name a cheaper one.
 * 2. People who already have access are refused rather than charged. Founding
 *    testers hold a lifetime grant, and a stray link must never take money
 *    from someone who was promised the product for free.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const priceId = Deno.env.get('STRIPE_PRICE_ID');
    const appUrl = (Deno.env.get('APP_URL') || '').replace(/\/+$/, '');

    if (!secretKey || !priceId || !appUrl) {
      console.error('[createCheckoutSession] missing config', {
        hasKey: Boolean(secretKey),
        hasPrice: Boolean(priceId),
        hasAppUrl: Boolean(appUrl),
      });
      return Response.json({ error: 'Payments are not configured' }, { status: 500 });
    }

    // Refuse to charge someone who already has access.
    const existing = await base44.asServiceRole.entities.Entitlement.filter({
      user_email: user.email,
    });
    const now = new Date();
    const alreadyHasAccess = (existing || []).some(
      (e) =>
        e.status === 'active' &&
        (e.plan === 'beta' || e.plan === 'paid') &&
        (!e.expires_at || new Date(e.expires_at) > now),
    );
    if (alreadyHasAccess) {
      return Response.json({ alreadyHasAccess: true });
    }

    const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });

    // Reuse the customer if this person has paid before, so Stripe does not
    // accumulate duplicate customers for the same email.
    const priorPaid = (existing || []).find((e) => e.stripe_customer_id);
    let customerId = priorPaid?.stripe_customer_id;
    if (!customerId) {
      const found = await stripe.customers.list({ email: user.email, limit: 1 });
      customerId = found.data[0]?.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      // The webhook is the only thing that grants access, and it needs to know
      // who this was for. client_reference_id survives the whole flow.
      client_reference_id: user.email,
      subscription_data: {
        metadata: { user_email: user.email },
      },
      metadata: { user_email: user.email },
      allow_promotion_codes: true,
      success_url: `${appUrl}/settings?checkout=success`,
      cancel_url: `${appUrl}/settings?checkout=cancelled`,
    });

    console.log('[createCheckoutSession] created', { email: user.email, id: session.id });
    return Response.json({ url: session.url, id: session.id });
  } catch (error) {
    console.error('[createCheckoutSession] error:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});
