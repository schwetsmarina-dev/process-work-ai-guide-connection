const PROBE_TOKEN = "talvira_probe_20260811_d7a4b2f1";

function apiBase(env: string) {
  return env === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

function eventNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item: any) => typeof item === "string" ? item : item?.name).filter(Boolean);
}

async function paddleGet(base: string, path: string, key: string) {
  const response = await fetch(base + path, {
    headers: {
      Authorization: `Bearer ${key}`,
      "Paddle-Version": "1",
    },
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== PROBE_TOKEN) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const env = Deno.env.get("PADDLE_ENV") ?? "";
  const apiKey = Deno.env.get("PADDLE_API_KEY") ?? "";
  const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET") ?? "";
  const clientToken = Deno.env.get("VITE_PADDLE_CLIENT_TOKEN") ?? "";
  const base = apiBase(env || "sandbox");

  const result: any = {
    env: env || "missing",
    configured: {
      api_key: Boolean(apiKey),
      webhook_secret: Boolean(webhookSecret),
      client_token: Boolean(clientToken),
    },
    api_base: base,
  };

  if (!apiKey) {
    return Response.json(result, { status: 500 });
  }

  const products = await paddleGet(base, "/products?status=active&per_page=50", apiKey);
  result.products_http = products.response.status;
  result.products = Array.isArray(products.json?.data)
    ? products.json.data.map((p: any) => ({ id: p.id, name: p.name, status: p.status }))
    : [];
  if (!products.response.ok) result.products_error = products.json?.error?.type ?? "request_failed";

  const prices = await paddleGet(base, "/prices?status=active&per_page=50", apiKey);
  result.prices_http = prices.response.status;
  result.prices = Array.isArray(prices.json?.data)
    ? prices.json.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        product_id: p.product_id,
        status: p.status,
        unit_price: p.unit_price,
        billing_cycle: p.billing_cycle,
        trial_period: p.trial_period,
      }))
    : [];
  if (!prices.response.ok) result.prices_error = prices.json?.error?.type ?? "request_failed";

  const destinations = await paddleGet(base, "/notification-settings?per_page=50", apiKey);
  result.notification_settings_http = destinations.response.status;
  result.notification_settings = Array.isArray(destinations.json?.data)
    ? destinations.json.data.map((d: any) => ({
        id: d.id,
        description: d.description,
        destination: d.destination,
        active: d.active,
        type: d.type,
        subscribed_events: eventNames(d.subscribed_events),
      }))
    : [];
  if (!destinations.response.ok) {
    result.notification_settings_error = destinations.json?.error?.type ?? "request_failed";
  }

  return Response.json(result);
});
