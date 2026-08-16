// Одноразовая проверка: статус approval домена(ов) в Paddle Checkout.
// Открыть: https://talvira-app.base44.app/functions/check-paddle-domain?token=<PADDLE_SEED_TOKEN>
//
// Примечание: в sandbox домены обычно не требуют approval вообще (checkout
// работает без него); approval нужен только для production-аккаунта.

import { Environment, Paddle } from "npm:@paddle/paddle-node-sdk";

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const expected = Deno.env.get("PADDLE_SEED_TOKEN") ?? "";
  if (!expected || token !== expected) {
    return Response.json({ error: "forbidden: bad or missing ?token=" }, { status: 403 });
  }
  const apiKey = Deno.env.get("PADDLE_API_KEY");
  if (!apiKey) return Response.json({ error: "PADDLE_API_KEY not set" }, { status: 500 });

  const env = Deno.env.get("PADDLE_ENV") ?? "sandbox";
  const base = env === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
  const headers = { Authorization: `Bearer ${apiKey}` };

  try {
    const res = await fetch(`${base}/checkout-domains`, { headers });
    const status = res.status;
    let body;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    return new Response(JSON.stringify({ ok: res.ok, env, http_status: status, body }, null, 2), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
});
