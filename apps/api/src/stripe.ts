import Stripe from "stripe";

import type { ResolvedEnv } from "./env.js";

let cached: Stripe | null = null;

export function isStripeConfigured(env: ResolvedEnv) {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_PRICE_ID_MONTHLY &&
      env.STRIPE_PRICE_ID_ANNUAL &&
      env.WEB_APP_URL
  );
}

export function getStripe(env: ResolvedEnv) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  if (cached) return cached;
  cached = new Stripe(env.STRIPE_SECRET_KEY, {
    // Keep API version pinned for predictable webhook payloads.
    apiVersion: "2025-08-27.basil"
  });
  return cached;
}


