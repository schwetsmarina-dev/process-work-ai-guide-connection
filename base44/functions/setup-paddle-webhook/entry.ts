// Одноразовая настройка вебхука Paddle через API — чтобы не искать ничего в
// панели Paddle. Создаёт notification destination на функцию paddle-webhook и
// ВОЗВРАЩАЕТ секрет назначения в JSON, который нужно вставить в Base44 как
// PADDLE_WEBHOOK_SECRET.
//
// Запуск (один раз): открыть в браузере
//   https://talvira-app.base44.app/functions/setup-paddle-webhook?token=<PADDLE_SEED_TOKEN>
//
// Секрет назначения Paddle отдаёт ТОЛЬКО в момент создания. Если запустить
// повторно и назначение уже есть — функция не создаёт дубль, а сообщает об этом.

const WEBHOOK_URL = "https://talvira-app.base44.app/functions/paddle-webhook";
const EVENTS = [
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "transaction.completed",
  "customer.created",
  "customer.updated",
];

function apiBase() {
  return (Deno.env.get("PADDLE_ENV") ?? "sandbox") === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const expected = Deno.env.get("PADDLE_SEED_TOKEN") ?? "";
  if (!expected || token !== expected) {
    return Response.json({ error: "forbidden: bad or missing ?token=" }, { status: 403 });
  }
  const apiKey = Deno.env.get("PADDLE_API_KEY");
  if (!apiKey) return Response.json({ error: "PADDLE_API_KEY not set" }, { status: 500 });

  const base = apiBase();
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  try {
    // Уже есть назначение на этот URL? (Секрет при этом не отдаётся повторно.)
    const listRes = await fetch(`${base}/notification-settings`, { headers });
    const listJson = await listRes.json();
    const existing = Array.isArray(listJson?.data)
      ? listJson.data.find((d) => d?.destination === WEBHOOK_URL)
      : null;

    if (existing) {
      return new Response(JSON.stringify({
        ok: true,
        already_exists: true,
        id: existing.id,
        note: "Назначение уже создано ранее. Секрет Paddle показывает только при создании. Если ты его не сохранила — удали это назначение в Paddle (Notifications) и запусти ссылку ещё раз, чтобы получить новый секрет.",
      }, null, 2), { headers: { "content-type": "application/json" } });
    }

    // Создаём назначение и получаем секрет.
    const createRes = await fetch(`${base}/notification-settings`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        description: "Talvira app webhook",
        destination: WEBHOOK_URL,
        type: "url",
        active: true,
        subscribed_events: EVENTS,
      }),
    });
    const createJson = await createRes.json();
    if (!createRes.ok) {
      return new Response(JSON.stringify({ ok: false, status: createRes.status, error: createJson }, null, 2),
        { status: 502, headers: { "content-type": "application/json" } });
    }

    const d = createJson?.data ?? {};
    return new Response(JSON.stringify({
      ok: true,
      created: true,
      id: d.id,
      destination: d.destination,
      subscribed_events: EVENTS,
      PADDLE_WEBHOOK_SECRET: d.endpoint_secret_key,
      next: "Скопируй значение PADDLE_WEBHOOK_SECRET и вставь его в Base44 → секреты как PADDLE_WEBHOOK_SECRET, затем опубликуй приложение.",
    }, null, 2), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
});
