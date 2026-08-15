// Creates a short-lived, authenticated Paddle customer portal link for the
// currently signed-in Talvira user. The portal is hosted by Paddle and lets
// the customer update payment details, view invoices, and cancel a subscription.

import { createClientFromRequest } from "npm:@base44/sdk";

function apiBase() {
  return (Deno.env.get("PADDLE_ENV") ?? "sandbox") === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = String(user.email).trim().toLowerCase();
    const rows = await base44.asServiceRole.entities.Entitlement.filter({
      user_email: email,
    });
    const entitlement = (rows ?? []).find(
      (row) =>
        row.plan === "paid" &&
        row.source === "paddle" &&
        row.paddle_customer_id &&
        row.paddle_subscription_id,
    );

    if (!entitlement) {
      return Response.json({ noSubscription: true }, { status: 404 });
    }

    const apiKey = Deno.env.get("PADDLE_API_KEY") ?? "";
    if (!apiKey) {
      console.error("[createPaddlePortalSession] PADDLE_API_KEY is not set");
      return Response.json({ error: "Payments are not configured" }, { status: 500 });
    }

    const response = await fetch(
      `${apiBase()}/customers/${encodeURIComponent(entitlement.paddle_customer_id)}/portal-sessions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription_ids: [entitlement.paddle_subscription_id],
        }),
      },
    );
    const json = await response.json();

    if (!response.ok) {
      console.error("[createPaddlePortalSession] Paddle API error", { status: response.status });
      return Response.json({ error: "Could not create customer portal session" }, { status: 502 });
    }

    const url = json?.data?.urls?.general?.overview;
    if (!url) {
      console.error("[createPaddlePortalSession] portal URL missing");
      return Response.json({ error: "Customer portal URL is unavailable" }, { status: 502 });
    }

    return Response.json({ url });
  } catch (error) {
    console.error("[createPaddlePortalSession] error", error?.message ?? String(error));
    return Response.json({ error: "Could not open billing portal" }, { status: 500 });
  }
});
