import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17';

/**
 * Opens the Stripe customer portal, where a person can update their card,
 * see invoices and cancel.
 *
 * Building this ourselves would mean handling cancellation, proration, tax
 * receipts and card updates by hand; Stripe's portal is also what makes the
 * "cancel any time" promise in the terms actually true.
 *
 * The customer id is looked up from the person's own entitlement — never taken
 * from the request, which would let anyone open anyone else's billing page.
 *
 * Environment: STRIPE_SECRET_KEY, APP_URL
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const appUrl = (Deno.env.get('APP_URL') || '').replace(/\/+$/, '');
    if (!secretKey || !appUrl) {
      return Response.json({ error: 'Payments are not configured' }, { status: 500 });
    }

    const rows = await base44.asServiceRole.entities.Entitlement.filter({
      user_email: user.email,
    });
    const withCustomer = (rows || []).find((e) => e.stripe_customer_id);

    if (!withCustomer) {
      // Beta and free users have no billing to manage. Not an error.
      return Response.json({ noSubscription: true });
    }

    const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });
    const session = await stripe.billingPortal.sessions.create({
      customer: withCustomer.stripe_customer_id,
      return_url: `${appUrl}/settings`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('[createPortalSession] error:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});
