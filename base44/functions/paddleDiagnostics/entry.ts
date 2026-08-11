const PROBE_TOKEN = "talvira_probe_20260811_d7a4b2f1";

function apiBase(env: string) {
  return env === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

function eventNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item: any) => typeof item === "string" ? item : item?.name).filter(Boolean);
}

async function paddleRequest(
  base: string,
  path: string,
  key: string,
  options: RequestInit = {},
) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      "Paddle-Version": "1",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function paddleGet(base: string, path: string, key: string) {
  return paddleRequest(base, path, key);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("action") === "checkout") {
    const clientToken = Deno.env.get("VITE_PADDLE_CLIENT_TOKEN") ?? "";
    if (!clientToken) return Response.json({ error: "client token missing" }, { status: 500 });
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Talvira Paddle Sandbox Probe</title>
  <script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
  <style>body{font-family:system-ui,sans-serif;max-width:520px;margin:60px auto;padding:24px}button,input{width:100%;box-sizing:border-box;padding:14px;border-radius:10px}input{border:1px solid #ccc;margin:12px 0}button{border:0;background:#6b3f58;color:#fff;font-weight:700;cursor:pointer}#status{margin-top:16px;color:#555;white-space:pre-wrap}</style>
</head>
<body>
  <h1>Talvira Paddle Sandbox</h1><p>Temporary end-to-end payment test. No real money.</p>
  <input id="email" type="email" value="talvira.paddle.test.20260811@example.com" aria-label="Test email">
  <button id="open" type="button">Open sandbox checkout</button><div id="status"></div>
  <script>
    const status = document.getElementById("status");
    Paddle.Environment.set("sandbox");
    Paddle.Initialize({token: ${JSON.stringify(clientToken)}, eventCallback: (event) => {
      status.textContent = event?.name || "event";
      if (event?.name === "checkout.completed") document.body.dataset.checkoutCompleted = "true";
    }});
    document.getElementById("open").addEventListener("click", () => {
      const email = document.getElementById("email").value.trim();
      Paddle.Checkout.open({items:[{priceId:"pri_01kz9pndmfjywzbhyedrf9eqca",quantity:1}],customer:email?{email}:undefined,settings:{variant:"one-page",displayMode:"overlay"}});
    });
  </script>
</body></html>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }
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
        traffic_source: d.traffic_source,
        subscribed_events: eventNames(d.subscribed_events),
      }))
    : [];
  if (!destinations.response.ok) {
    result.notification_settings_error = destinations.json?.error?.type ?? "request_failed";
  }

  const action = url.searchParams.get("action");
  if (action === "simulate" || action === "simulate-subscription") {
    const target = result.notification_settings.find(
      (d: any) => d.destination === "https://talvira-app.base44.app/functions/paddle-webhook" && d.active,
    );
    if (!target) {
      return Response.json({ ...result, simulation_error: "active webhook destination not found" }, { status: 500 });
    }

    if (target.traffic_source !== "all") {
      const updated = await paddleRequest(
        base,
        `/notification-settings/${encodeURIComponent(target.id)}`,
        apiKey,
        { method: "PATCH", body: JSON.stringify({ traffic_source: "all" }) },
      );
      result.notification_setting_update_http = updated.response.status;
      if (!updated.response.ok) {
        result.simulation_error = updated.json?.error?.type ?? "could_not_enable_simulation_traffic";
        result.simulation_error_code = updated.json?.error?.code ?? null;
        return Response.json(result, { status: 502 });
      }
      target.traffic_source = updated.json?.data?.traffic_source ?? "all";
    }

    const requiredEvents = [
      "subscription.created",
      "subscription.trialing",
      "subscription.activated",
      "subscription.updated",
      "subscription.past_due",
      "subscription.paused",
      "subscription.resumed",
      "subscription.canceled",
      "transaction.completed",
      "customer.created",
      "customer.updated",
    ];
    if (requiredEvents.some((name) => !target.subscribed_events.includes(name))) {
      const updatedEvents = await paddleRequest(
        base,
        `/notification-settings/${encodeURIComponent(target.id)}`,
        apiKey,
        {
          method: "PATCH",
          body: JSON.stringify({ subscribed_events: requiredEvents, traffic_source: "all" }),
        },
      );
      result.notification_events_update_http = updatedEvents.response.status;
      if (!updatedEvents.response.ok) {
        result.simulation_error = updatedEvents.json?.error?.type ?? "could_not_update_webhook_events";
        result.simulation_error_code = updatedEvents.json?.error?.code ?? null;
        return Response.json(result, { status: 502 });
      }
      target.subscribed_events = eventNames(updatedEvents.json?.data?.subscribed_events);
    }

    const isSubscriptionProbe = action === "simulate-subscription";
    const simulationName = isSubscriptionProbe
      ? "Talvira subscription provisioning check"
      : "Talvira webhook health check";
    let simulationType = "customer.updated";
    let simulationConfig: any = undefined;

    if (isSubscriptionProbe) {
      const testEmail = "talvira.paddle.test.20260811@example.com";
      const customers = await paddleGet(
        base,
        `/customers?email=${encodeURIComponent(testEmail)}&per_page=50`,
        apiKey,
      );
      let customer = Array.isArray(customers.json?.data) ? customers.json.data[0] : null;
      if (!customer) {
        const createdCustomer = await paddleRequest(base, "/customers", apiKey, {
          method: "POST",
          body: JSON.stringify({ email: testEmail, name: "Talvira Paddle Test" }),
        });
        result.customer_create_http = createdCustomer.response.status;
        if (!createdCustomer.response.ok) {
          result.simulation_error = createdCustomer.json?.error?.type ?? "could_not_create_test_customer";
          result.simulation_error_code = createdCustomer.json?.error?.code ?? null;
          result.simulation_error_detail = createdCustomer.json?.error?.detail ?? null;
          return Response.json(result, { status: 502 });
        }
        customer = createdCustomer.json?.data;
      }
      result.test_customer_id = customer?.id ?? null;
      simulationType = "subscription_creation";
      simulationConfig = {
        subscription_creation: {
          entities: {
            customer_id: customer.id,
            items: [{ price_id: "pri_01kz9pndmfjywzbhyedrf9eqca", quantity: 1 }],
          },
          options: {
            customer_simulated_as: "existing_details_prefilled",
            business_simulated_as: "not_provided",
            discount_simulated_as: "not_provided",
          },
        },
      };
    }

    const list = await paddleGet(
      base,
      `/simulations?notification_setting_id=${encodeURIComponent(target.id)}&per_page=50`,
      apiKey,
    );
    let simulation = Array.isArray(list.json?.data)
      ? list.json.data.find((s: any) => s.name === simulationName && s.status === "active")
      : null;

    if (!simulation) {
      const payload: any = {
        notification_setting_id: target.id,
        name: simulationName,
        type: simulationType,
      };
      if (simulationConfig) payload.config = simulationConfig;

      const created = await paddleRequest(base, "/simulations", apiKey, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      result.simulation_create_http = created.response.status;
      if (!created.response.ok) {
        result.simulation_error = created.json?.error?.type ?? "could_not_create_simulation";
        result.simulation_error_code = created.json?.error?.code ?? null;
        result.simulation_error_detail = created.json?.error?.detail ?? null;
        result.simulation_error_fields = created.json?.error?.errors ?? null;
        return Response.json(result, { status: 502 });
      }
      simulation = created.json?.data;
    }

    const run = await paddleRequest(
      base,
      `/simulations/${encodeURIComponent(simulation.id)}/runs`,
      apiKey,
      { method: "POST" },
    );
    result.simulation_run_http = run.response.status;
    if (!run.response.ok) {
      result.simulation_error = run.json?.error?.type ?? "could_not_start_simulation";
      result.simulation_error_code = run.json?.error?.code ?? null;
      result.simulation_error_detail = run.json?.error?.detail ?? null;
      return Response.json(result, { status: 502 });
    }

    const runId = run.json?.data?.id;
    result.simulation_id = simulation.id;
    result.simulation_run_id = runId;

    let runState: any = run.json?.data ?? {};
    for (let attempt = 0; attempt < 8 && runState?.status === "pending"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const current = await paddleGet(
        base,
        `/simulations/${encodeURIComponent(simulation.id)}/runs/${encodeURIComponent(runId)}?include=events`,
        apiKey,
      );
      if (current.response.ok) runState = current.json?.data ?? runState;
    }

    result.simulation_status = runState?.status ?? "unknown";
    result.simulation_events = Array.isArray(runState?.events)
      ? runState.events.map((event: any) => ({
          id: event.id,
          status: event.status,
          response_code: event.response_code ?? event.response?.status_code ?? null,
        }))
      : [];
  }

  return Response.json(result);
});
