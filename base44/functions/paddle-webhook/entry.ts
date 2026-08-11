// Paddle webhook → Entitlement (Merchant of Record subscriptions)
//
// Публичный URL функции: https://<домен приложения>/functions/paddle-webhook
// Его нужно указать как Notification destination в Paddle.
//
// Требуемые секреты (Base44 → настройки приложения → secrets):
//   PADDLE_API_KEY          — pdl_sdbx_apikey_... (sandbox) / live-ключ
//   PADDLE_WEBHOOK_SECRET   — секрет ЭТОГО notification destination (pdl_ntfset_...)
//   PADDLE_ENV              — "sandbox" или "production"
//
// Правила доставки Paddle (важно!):
//   • доставленным считается ТОЛЬКО ответ 2xx за ~5 секунд;
//   • на любой сбой (в т.ч. подпись) отвечаем НЕ-2xx → Paddle повторит попытку;
//   • один и тот же событие приходит на повторах → обработчик идемпотентен (upsert).

import { createClientFromRequest } from "npm:@base44/sdk";
import { Environment, Paddle } from "npm:@paddle/paddle-node-sdk";

const paddle = new Paddle(Deno.env.get("PADDLE_API_KEY") ?? "", {
  environment: (Deno.env.get("PADDLE_ENV") ?? "sandbox") as Environment,
});

// Paddle subscription.status → Entitlement.status
function mapStatus(paddleStatus: string): string {
  switch (paddleStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "paused":
      return "revoked";
    case "canceled":
      return "canceled";
    default:
      return "revoked";
  }
}

Deno.serve(async (req) => {
  const signature = req.headers.get("paddle-signature") ?? "";
  const rawBody = await req.text(); // сырое тело — НЕ парсить до проверки подписи
  const secret = Deno.env.get("PADDLE_WEBHOOK_SECRET") ?? "";

  if (!signature || !rawBody) {
    return Response.json({ error: "missing signature or body" }, { status: 400 });
  }

  try {
    // Проверяет HMAC + timestamp и возвращает типизированное событие, иначе бросает.
    const event = await paddle.webhooks.unmarshal(rawBody, secret, signature);
    const base44 = createClientFromRequest(req);
    const Entitlement = base44.asServiceRole.entities.Entitlement;

    switch (event?.eventType) {
      case "subscription.created":
      case "subscription.trialing":
      case "subscription.activated":
      case "subscription.updated":
      case "subscription.past_due":
      case "subscription.paused":
      case "subscription.resumed":
      case "subscription.canceled": {
        const s: any = event.data;

        // Разрешаем email пользователя: сперва из уже существующей записи,
        // иначе тянем из Paddle по customerId (одиночный вызов, быстро).
        let email = "";
        const bySub = await Entitlement.filter({ paddle_subscription_id: s.id });
        if (bySub?.length) email = bySub[0].user_email ?? "";
        if (!email && s.customerId) {
          const customer = await paddle.customers.get(s.customerId);
          email = customer?.email ?? "";
        }
        // ВАЖНО: приложение хранит и ищет entitlements по email в НИЖНЕМ регистре
        // (см. getEntitlement). Нормализуем, иначе "оплачено, а доступа нет".
        email = email.trim().toLowerCase();
        if (!email) {
          // Без email не к кому привязать доступ — вернём не-2xx, Paddle повторит.
          throw new Error("cannot resolve customer email for subscription " + s.id);
        }

        const mapped = mapStatus(s.status);
        const scheduled = s.scheduledChange?.effectiveAt ?? null;
        const data = {
          user_email: email,
          plan: "paid",
          status: mapped,
          source: "paddle",
          paddle_customer_id: s.customerId ?? "",
          paddle_subscription_id: s.id,
          price_id: s.items?.[0]?.price?.id ?? "",
          product_id: s.items?.[0]?.price?.productId ?? "",
          scheduled_change: scheduled,
          // Доступ заканчивается на дату запланированной отмены/паузы,
          // либо сразу, если подписка уже canceled; иначе не ограничиваем.
          expires_at: scheduled ?? (mapped === "canceled" ? new Date().toISOString() : null),
        };

        // Upsert: по paddle_subscription_id → иначе апгрейдим строку того же email → иначе создаём.
        if (bySub?.length) {
          await Entitlement.update(bySub[0].id, data);
        } else {
          const byEmail = await Entitlement.filter({ user_email: email });
          if (byEmail?.length) {
            await Entitlement.update(byEmail[0].id, data);
          } else {
            await Entitlement.create(data);
          }
        }
        break;
      }

      default:
        // На события, которые пока не обрабатываем, всё равно отвечаем 2xx.
        break;
    }

    return Response.json({ received: true });
  } catch (e) {
    console.error("paddle-webhook error:", e);
    // Не-2xx → Paddle повторит доставку. НИКОГДА не 2xx при ошибке.
    return Response.json({ error: "verification or processing failed" }, { status: 500 });
  }
});
