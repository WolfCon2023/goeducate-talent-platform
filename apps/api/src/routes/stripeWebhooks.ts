import type { Request, Response } from "express";
import mongoose from "mongoose";
import Stripe from "stripe";

import { ROLE } from "@goeducate/shared";

import { getEnv } from "../env.js";
import { COACH_SUBSCRIPTION_STATUS, UserModel } from "../models/User.js";
import { getStripe } from "../stripe.js";

function isActiveStripeSubscription(status: Stripe.Subscription.Status) {
  return status === "active" || status === "trialing";
}

async function resolveCoachByStripeCustomerId(stripe: Stripe, customerId: string) {
  // First try stored mapping.
  const byCustomer = await UserModel.findOne({ stripeCustomerId: customerId });
  if (byCustomer) return byCustomer;

  // Fallback: use Stripe customer metadata.
  const customer = (await stripe.customers.retrieve(customerId)) as unknown as Stripe.Customer | Stripe.DeletedCustomer;
  if (customer && typeof customer !== "string" && !(customer as Stripe.DeletedCustomer).deleted) {
    const userId = (customer as Stripe.Customer).metadata?.userId;
    if (userId && mongoose.isValidObjectId(userId)) {
      const byId = await UserModel.findById(userId);
      if (byId && !byId.stripeCustomerId) {
        byId.stripeCustomerId = customerId;
        await byId.save();
      }
      return byId;
    }
  }
  return null;
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return res.status(501).send("Stripe not configured");
  }

  const stripe = getStripe(env);
  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    return res.status(400).send("Missing Stripe signature");
  }

  let event: Stripe.Event;
  try {
    // IMPORTANT: req.body must be the raw Buffer (configured in server.ts).
    event = stripe.webhooks.constructEvent(req.body as any, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return res.status(400).send(`Webhook Error: ${msg}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

        if (userId && mongoose.isValidObjectId(userId)) {
          const user = await UserModel.findById(userId);
          if (user && user.role === ROLE.COACH) {
            if (customerId) user.stripeCustomerId = customerId;
            if (subscriptionId) user.stripeSubscriptionId = subscriptionId;
            await user.save();
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const user = await resolveCoachByStripeCustomerId(stripe, customerId);
        if (user && user.role === ROLE.COACH) {
          user.stripeCustomerId = user.stripeCustomerId ?? customerId;
          user.stripeSubscriptionId = sub.id;
          user.subscriptionStatus = isActiveStripeSubscription(sub.status)
            ? COACH_SUBSCRIPTION_STATUS.ACTIVE
            : COACH_SUBSCRIPTION_STATUS.INACTIVE;
          await user.save();
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler error", err);
    // Return 200 so Stripe doesn't retry forever for non-deterministic errors.
    return res.status(200).json({ received: true });
  }

  return res.status(200).json({ received: true });
}


