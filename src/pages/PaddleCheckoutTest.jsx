import React, { useState } from "react";
import { openPaddleCheckout, PADDLE_PRICE_ID } from "@/lib/paddle";

export default function PaddleCheckoutTest() {
  const [error, setError] = useState("");

  const open = async () => {
    setError("");
    try {
      await openPaddleCheckout(PADDLE_PRICE_ID);
    } catch (e) {
      setError(e?.message || String(e));
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 space-y-4">
        <h1 className="text-xl font-semibold">Talvira Paddle Sandbox</h1>
        <p className="text-sm text-muted-foreground">Temporary end-to-end checkout test.</p>
        <button
          type="button"
          onClick={open}
          className="w-full rounded-xl bg-primary px-4 py-3 text-primary-foreground"
        >
          Open sandbox checkout
        </button>
        {error ? <p className="text-sm text-destructive break-words">{error}</p> : null}
      </div>
    </main>
  );
}
