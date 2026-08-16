// Одноразовая проверка: статус approval домена(ов) в Paddle Checkout.
//
// Sandbox (текущий рабочий ключ, ничего менять не нужно):
//   https://talvira-app.base44.app/functions/check-paddle-domain?token=<PADDLE_SEED_TOKEN>
// Live (нужен отдельный секрет PADDLE_API_KEY_LIVE — live-ключ из Paddle,
// переключённого в режим Live, страница Authentication):
//   https://talvira-app.base44.app/functions/check-paddle-domain?token=<PADDLE_SEED_TOKEN>&env=production
//
// Примечание: в sandbox домены НЕ требуют approval вообще (checkout работает
// без него) — там "approved" ничего не значит. Реальный статус ожидания
// смотрим только через env=production, отдельным live-ключом.

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const expected = Deno.env.get("PADDLE_SEED_TOKEN") ?? "";
  if (!expected || token !== expected) {
    return Response.json({ error: "forbidden: bad or missing ?token=" }, { status: 403 });
  }

  const env = url.searchParams.get("env") === "production" ? "production" : "sandbox";
  const apiKey = env === "production"
    ? Deno.env.get("PADDLE_API_KEY_LIVE")
    : Deno.env.get("PADDLE_API_KEY");

  if (!apiKey) {
    return Response.json({
      error: env === "production"
        ? "PADDLE_API_KEY_LIVE not set — add a live API key from Paddle (switch dashboard to Live mode → Developer tools → Authentication) as a Base44 secret named PADDLE_API_KEY_LIVE, then republish."
        : "PADDLE_API_KEY not set",
    }, { status: 500 });
  }

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
