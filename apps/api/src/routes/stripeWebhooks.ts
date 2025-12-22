import type { Request, Response } from "express";
import mongoose from "mongoose";
import Stripe from "stripe";

import { ROLE } from "@goeducate/shared";

import { getEnv } from "../env.js";
import { COACH_SUBSCRIPTION_STATUS, UserModel } from "../models/User.js";
import { getStripe } from "../stripe.js";
import { ShowcaseModel } from "../models/Showcase.js";
import { ShowcaseRegistrationModel, SHOWCASE_REGISTRATION_STATUS } from "../models/ShowcaseRegistration.js";
import { isShowcaseEmailConfigured, sendShowcaseRegistrationEmail } from "../email/showcases.js";

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
        const kind = session.metadata?.kind;
        // New: showcase registrations (one-time payments)
        if (kind === "showcase_registration") {
          const showcaseId = session.metadata?.showcaseId ?? "";
          const fullName = session.metadata?.fullName ?? "";
          const email = session.metadata?.email ?? "";
          const role = session.metadata?.role;
          const sport = session.metadata?.sport;
          const userId = session.metadata?.userId;
          const waiverAcceptedAt = session.metadata?.waiverAcceptedAt;
          const waiverVersion = session.metadata?.waiverVersion;
          const refundPolicyAcceptedAt = session.metadata?.refundPolicyAcceptedAt;
          const refundPolicyVersion = session.metadata?.refundPolicyVersion;

          if (showcaseId && mongoose.isValidObjectId(showcaseId) && session.id) {
            const showcase = await ShowcaseModel.findById(showcaseId).lean();
            if (showcase) {
              // Create registration record once (idempotent by unique session id).
              const existing = await ShowcaseRegistrationModel.findOne({ stripeCheckoutSessionId: session.id }).lean();
              if (!existing) {
                await ShowcaseRegistrationModel.create({
                  showcaseId: new mongoose.Types.ObjectId(showcaseId),
                  ...(userId && mongoose.isValidObjectId(userId) ? { userId: new mongoose.Types.ObjectId(userId) } : {}),
                  fullName: String(fullName).trim() || "Registrant",
                  email: String(email).trim().toLowerCase(),
                  ...(role ? { role: String(role) } : {}),
                  ...(sport ? { sport: String(sport) } : {}),
                  ...(waiverAcceptedAt ? { waiverAcceptedAt: new Date(String(waiverAcceptedAt)) } : {}),
                  ...(waiverVersion ? { waiverVersion: String(waiverVersion) } : {}),
                  ...(refundPolicyAcceptedAt ? { refundPolicyAcceptedAt: new Date(String(refundPolicyAcceptedAt)) } : {}),
                  ...(refundPolicyVersion ? { refundPolicyVersion: String(refundPolicyVersion) } : {}),
                  paymentStatus: SHOWCASE_REGISTRATION_STATUS.PAID,
                  stripeCheckoutSessionId: session.id,
                  stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id
                });

                // Decrement capacity if enforced.
                if (typeof showcase.capacity === "number" && typeof showcase.spotsRemaining === "number") {
                  await ShowcaseModel.updateOne(
                    { _id: showcase._id, spotsRemaining: { $gt: 0 } },
                    { $inc: { spotsRemaining: -1 } }
                  );
                }

                // Send confirmation email (best effort)
                if (isShowcaseEmailConfigured()) {
                  try {
                    const env = getEnv();
                    const base = (env.WEB_APP_URL ?? "").replace(/\/+$/, "");
                    const detailsUrl = `${base}/showcases/${encodeURIComponent(String(showcase.slug ?? showcase._id))}`;
                    await sendShowcaseRegistrationEmail({
                      to: String(email).trim().toLowerCase(),
                      fullName: String(fullName).trim() || "Registrant",
                      showcaseTitle: String(showcase.title ?? "Showcase"),
                      startDateTimeIso: showcase.startDateTime ? new Date(showcase.startDateTime).toISOString() : null,
                      city: showcase.city,
                      state: showcase.state,
                      detailsUrl
                    });
                  } catch (err) {
                    console.error("[stripe webhook] showcase email failed", err);
                  }
                }
              }
            }
          }
          break;
        }

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


