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

const ENV = import.meta.env.VITE_PADDLE_ENV || "sandbox";
// Paddle client-side tokens are public by design. This sandbox fallback lets
// the Base44-hosted preview open Checkout without storing a production token
// in source. Live mode still requires VITE_PADDLE_CLIENT_TOKEN.
const SANDBOX_CLIENT_TOKEN = "test_1352fd0772cbdc4339dd664f7e2";
const CLIENT_TOKEN =
  import.meta.env.VITE_PADDLE_CLIENT_TOKEN ||
  (ENV === "sandbox" ? SANDBOX_CLIENT_TOKEN : "");
const CDN = "https://cdn.paddle.com/paddle/v2/paddle.js";

// One launch offer: Founder, €9.99/month. Keep the sandbox fallback only for
// the already-created sandbox catalog; production must receive its own live
// price through VITE_PADDLE_PRICE_ID so a sandbox ID can never leak into live.
const SANDBOX_FOUNDER_PRICE_ID = "pri_01kz9pndmfjywzbhyedrf9eqca";
export const PADDLE_PRICE_ID =
  import.meta.env.VITE_PADDLE_PRICE_ID || (ENV === "sandbox" ? SANDBOX_FOUNDER_PRICE_ID : "");

/**
 * Minimal surface of the Paddle browser SDK used by this module.
 * Keeping this local avoids weakening typechecking for the rest of the app.
 * @typedef {{
 *   Environment: { set: (environment: string) => void },
 *   Initialize: (options: { token: string, eventCallback: (event: { name?: string } | undefined) => void }) => void,
 *   Checkout: { open: (options: object) => void }
 * }} PaddleBrowserSdk
 */

/** @returns {PaddleBrowserSdk | undefined} */
function readPaddleGlobal() {
  return /** @type {Window & { Paddle?: PaddleBrowserSdk }} */ (window).Paddle;
}

// The overlay's completion handler is set per-open but delivered through the
// single global eventCallback Paddle v2 expects, so we route it via this ref.
/** @type {(() => void) | null} */
let onCompleteRef = null;
/** @type {Promise<PaddleBrowserSdk> | null} */
let paddlePromise = null;

/** @returns {Promise<PaddleBrowserSdk>} */
function loadScript() {
  return new Promise((resolve, reject) => {
    const loaded = readPaddleGlobal();
    if (loaded) return resolve(loaded);

    const existing = document.querySelector(`script[src="${CDN}"]`);
    if (existing) {
      existing.addEventListener("load", () => {
        const Paddle = readPaddleGlobal();
        if (Paddle) resolve(Paddle);
        else reject(new Error("Paddle SDK loaded but window.Paddle is unavailable"));
      });
      existing.addEventListener("error", reject);
      return;
    }

    const s = document.createElement("script");
    s.src = CDN;
    s.async = true;
    s.onload = () => {
      const Paddle = readPaddleGlobal();
      if (Paddle) resolve(Paddle);
      else reject(new Error("Paddle SDK loaded but window.Paddle is unavailable"));
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/** Load + initialise Paddle once. Resolves to the Paddle browser SDK. */
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
