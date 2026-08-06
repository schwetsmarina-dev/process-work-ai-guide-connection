// Paddle.js (v2) loader + overlay checkout helper for the frontend.
//
// Loads Paddle from the official CDN (no npm dependency to install), initialises
// it once with the PUBLIC client-side token, and opens overlay checkout for a
// price. The client-side token is safe to expose in the frontend by design.
//
// Env vars (Base44 → app settings; the VITE_ prefix exposes them to the frontend):
//   VITE_PADDLE_CLIENT_TOKEN — public client-side token from Paddle → Authentication
//                              (starts with test_ in sandbox, live_ in production)
//   VITE_PADDLE_ENV          — "sandbox" or "production" (defaults to "sandbox")

import { base44 } from "@/api/base44Client";

// Price IDs created in Paddle (sandbox). Starter Monthly is the active plan.
export const PADDLE_PRICES = {
  STARTER_MONTHLY: "pri_01kz9pndmfjywzbhyedrf9eqca",
  STARTER_YEARLY: "pri_01kz9pndrjqghappxjabn723sp",
  PRO_MONTHLY: "pri_01kz9pne9ecpxm2qp114p9p64t",
  PRO_YEARLY: "pri_01kz9pned8c4merzrdmvemdz3x",
  ADVANCED_MONTHLY: "pri_01kz9pnerq60qwt8t72axawmjv",
  ADVANCED_YEARLY: "pri_01kz9pnewvgn8e7dnf38xa1th7",
};

const CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
const ENV = import.meta.env.VITE_PADDLE_ENV || "sandbox";
const CDN = "https://cdn.paddle.com/paddle/v2/paddle.js";

// The overlay's completion handler is set per-open but delivered through the
// single global eventCallback Paddle v2 expects, so we route it via this ref.
let onCompleteRef = null;
let paddlePromise = null;

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.Paddle) return resolve(window.Paddle);
    const existing = document.querySelector(`script[src="${CDN}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Paddle));
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = CDN;
    s.async = true;
    s.onload = () => resolve(window.Paddle);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/** Load + initialise Paddle once. Resolves to window.Paddle. */
export async function getPaddle() {
  if (!CLIENT_TOKEN) {
    throw new Error("VITE_PADDLE_CLIENT_TOKEN is not set");
  }
  if (paddlePromise) return paddlePromise;
  paddlePromise = (async () => {
    const Paddle = await loadScript();
    if (ENV === "sandbox") Paddle.Environment.set("sandbox");
    Paddle.Initialize({
      token: CLIENT_TOKEN,
      eventCallback: (ev) => {
        if (ev?.name === "checkout.completed" && typeof onCompleteRef === "function") {
          onCompleteRef();
        }
      },
    });
    return Paddle;
  })();
  return paddlePromise;
}

/**
 * Open Paddle overlay checkout for a price. Pre-fills the signed-in user's
 * email so the purchase links to a customer the webhook can match.
 * @param {string} priceId
 * @param {{ onComplete?: () => void }} [opts]
 */
export async function openPaddleCheckout(priceId, opts = {}) {
  const Paddle = await getPaddle();
  onCompleteRef = typeof opts.onComplete === "function" ? opts.onComplete : null;

  let email;
  try {
    const me = await base44.auth.me();
    email = me?.email || undefined;
  } catch {
    // Not signed in — Paddle will collect the email at checkout.
  }

  Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: email ? { email } : undefined,
    settings: { variant: "one-page", displayMode: "overlay" },
  });
}
