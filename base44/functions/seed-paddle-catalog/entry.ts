// Одноразовый сидер каталога Paddle (Merchant of Record).
//
// Создаёт продукты Starter / Pro / Advanced, каждому — месячную и годовую цену
// в EUR (база), 3-дневный триал и overrides по странам US/UK/AU.
// Ирландия = EUR = база, отдельный override не нужен. "Advanced Pro" — это
// «запросить демо», ценой не заводится.
//
// Безопасно к повторному запуску: продукт/цена с таким же именем не дублируется.
//
// Запуск (один раз):
//   1) В Base44 → секреты приложения задать:
//        PADDLE_API_KEY     = sandbox-ключ Paddle (pdl_sdbx_apikey_...)
//        PADDLE_ENV         = sandbox
//        PADDLE_SEED_TOKEN  = любая случайная строка (напр. seed-talvira-2026)
//   2) Опубликовать приложение.
//   3) Открыть в браузере:
//        https://<домен>/functions/seed-paddle-catalog?token=<PADDLE_SEED_TOKEN>
//      Функция вернёт JSON с product_id / price_id по всем тарифам.
//   4) После сверки можно удалить эту функцию и секрет PADDLE_SEED_TOKEN.

import { Environment, Paddle } from "npm:@paddle/paddle-node-sdk";

const TRIAL = { interval: "day" as const, frequency: 3 };
const TAX_CATEGORY = "standard"; // "Standard digital goods" (без доп. одобрения Paddle)
const CURRENCY: Record<string, string> = { US: "USD", GB: "GBP", AU: "AUD" };

// Все суммы — строки в наименьших единицах (999 = €9.99).
const CATALOG = [
  {
    name: "Starter",
    description: "Talvira Starter — активный тариф",
    prices: [
      { name: "Starter – Monthly", interval: "month", eur: "999", ov: { US: "999", GB: "899", AU: "1599" } },
      { name: "Starter – Yearly",  interval: "year",  eur: "9900", ov: { US: "9900", GB: "8900", AU: "15900" } },
    ],
  },
  {
    name: "Pro",
    description: "Talvira Pro — на вырост",
    prices: [
      { name: "Pro – Monthly", interval: "month", eur: "3999", ov: { US: "4499", GB: "3499", AU: "6499" } },
      { name: "Pro – Yearly",  interval: "year",  eur: "39900", ov: { US: "44900", GB: "34900", AU: "64900" } },
    ],
  },
  {
    name: "Advanced",
    description: "Talvira Advanced — на вырост",
    prices: [
      { name: "Advanced – Monthly", interval: "month", eur: "11900", ov: { US: "12900", GB: "10500", AU: "18900" } },
      { name: "Advanced – Yearly",  interval: "year",  eur: "119000", ov: { US: "129000", GB: "105000", AU: "189000" } },
    ],
  },
];

function overrides(ov: Record<string, string>) {
  return Object.entries(ov).map(([cc, amount]) => ({
    countryCodes: [cc],
    unitPrice: { amount, currencyCode: CURRENCY[cc] },
  }));
}

Deno.serve(async (req) => {
  // --- защита токеном ---
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const expected = Deno.env.get("PADDLE_SEED_TOKEN") ?? "";
  if (!expected || token !== expected) {
    return Response.json({ error: "forbidden: bad or missing ?token=" }, { status: 403 });
  }
  const apiKey = Deno.env.get("PADDLE_API_KEY");
  if (!apiKey) return Response.json({ error: "PADDLE_API_KEY not set" }, { status: 500 });

  const paddle = new Paddle(apiKey, {
    environment: (Deno.env.get("PADDLE_ENV") ?? "sandbox") as Environment,
  });

  try {
    // Существующие продукты по имени (чтобы не дублировать при повторном запуске).
    const productByName = new Map<string, string>();
    for await (const p of paddle.products.list({ status: ["active"] })) {
      if (p?.name) productByName.set(p.name, p.id);
    }

    const result: any[] = [];

    for (const prod of CATALOG) {
      // продукт
      let productId = productByName.get(prod.name);
      let productCreated = false;
      if (!productId) {
        const created = await paddle.products.create({
          name: prod.name,
          description: prod.description,
          taxCategory: TAX_CATEGORY as any,
        });
        productId = created.id;
        productCreated = true;
      }

      // существующие цены этого продукта по имени
      const priceByName = new Map<string, string>();
      for await (const pr of paddle.prices.list({ productId: [productId] })) {
        if (pr?.name) priceByName.set(pr.name, pr.id);
      }

      const priceRows: any[] = [];
      for (const price of prod.prices) {
        let priceId = priceByName.get(price.name);
        let priceCreated = false;
        if (!priceId) {
          const createdPrice = await paddle.prices.create({
            productId,
            name: price.name,
            description: price.name,
            unitPrice: { amount: price.eur, currencyCode: "EUR" },
            billingCycle: { interval: price.interval as any, frequency: 1 },
            trialPeriod: TRIAL,
            unitPriceOverrides: overrides(price.ov),
          });
          priceId = createdPrice.id;
          priceCreated = true;
        }
        priceRows.push({
          price: price.name,
          price_id: priceId,
          eur: price.eur,
          overrides: price.ov,
          created: priceCreated,
        });
      }

      result.push({ product: prod.name, product_id: productId, created: productCreated, prices: priceRows });
    }

    return new Response(JSON.stringify({ ok: true, env: Deno.env.get("PADDLE_ENV") ?? "sandbox", catalog: result }, null, 2), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("seed-paddle-catalog error:", e);
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
});
