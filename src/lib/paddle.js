// Paddle.js (v2) overlay checkout helper for the frontend.
//
// The official Paddle wrapper is the supported loader for bundled Vite apps.
// It downloads and initialises Paddle.js once with the public client-side token,
// then exposes the same Checkout API as Paddle.js itself.
//
// Env vars (Base44 → app settings; the VITE_ prefix exposes them to the frontend):
//   VITE_PADDLE_CLIENT_TOKEN — public client-side token from Paddle → Authentication
//                              (starts with test_ in sandbox, live_ in production)
//   VITE_PADDLE_ENV          — "sandbox" or "production" (defaults to "sandbox")

import { initializePaddle } from "@paddle/paddle-js";
import { base44 } from "@/api/base44Client";

const ENV = import.meta.env.VITE_PADDLE_ENV || "sandbox";
// Paddle client-side tokens are public by design. This sandbox fallback lets
// the Base44-hosted preview open Checkout without storing a production token
// in source. Live mode still requires VITE_PADDLE_CLIENT_TOKEN.
const SANDBOX_CLIENT_TOKEN = "test_1352fd0772cbdc4339dd664f7e2";
const CLIENT_TOKEN =
  import.meta.env.VITE_PADDLE_CLIENT_TOKEN ||
  (ENV === "sandbox" ? SANDBOX_CLIENT_TOKEN : "");

// One launch offer: Founder, €9.99/month. Keep the sandbox fallback only for
// the already-created sandbox catalog; production must receive its own live
// price through VITE_PADDLE_PRICE_ID so a sandbox ID can never leak into live.
const SANDBOX_FOUNDER_PRICE_ID = "pri_01kz9pndmfjywzbhyedrf9eqca";
export const PADDLE_PRICE_ID =
  import.meta.env.VITE_PADDLE_PRICE_ID || (ENV === "sandbox" ? SANDBOX_FOUNDER_PRICE_ID : "");

// The overlay's completion handler is set per-open but delivered through the
// single eventCallback Paddle expects, so we route it via this ref.
/** @type {(() => void) | null} */
let onCompleteRef = null;
/** @type {ReturnType<typeof initializePaddle> | null} */
let paddlePromise = null;

/** Load + initialise Paddle once. Resolves to the Paddle browser SDK. */
export async function getPaddle() {
  if (!CLIENT_TOKEN) {
    throw new Error("VITE_PADDLE_CLIENT_TOKEN is not set");
  }
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      environment: ENV === "sandbox" ? "sandbox" : "production",
      token: CLIENT_TOKEN,
      eventCallback: (ev) => {
        if (ev?.name === "checkout.completed" && typeof onCompleteRef === "function") {
          onCompleteRef();
        }
      },
    })
      .then((Paddle) => {
        if (!Paddle) {
          throw new Error("Paddle.js did not initialize");
        }
        return Paddle;
      })
      .catch((error) => {
        // Allow a retry after a transient CDN or browser-network failure.
        paddlePromise = null;
        const message = error instanceof Error ? error.message : "Paddle.js failed to load";
        throw new Error(message, { cause: error });
      });
  }
  return paddlePromise;
}

/**
 * Open Paddle overlay checkout for a price. Pre-fills the signed-in user's
 * email so the purchase links to a customer the webhook can match.
 * @param {string} priceId
 * @param {{ onComplete?: () => void }} [opts]
 */
export async function openPaddleCheckout(priceId, opts = {}) {
  if (!priceId) {
    throw new Error("VITE_PADDLE_PRICE_ID is not set for this environment");
  }
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
