import { Router } from "express";
import mongoose from "mongoose";
import { ROLE } from "@goeducate/shared";
import { getEnv } from "../env.js";
import { ApiError } from "../http/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { COACH_SUBSCRIPTION_STATUS, UserModel } from "../models/User.js";
import { getStripe, isStripeConfigured } from "../stripe.js";
export const billingRouter = Router();
function getCoachOrThrow(user) {
    if (!user)
        throw new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Not authenticated" });
    if (user.role !== ROLE.COACH)
        throw new ApiError({ status: 403, code: "FORBIDDEN", message: "Coach only" });
    return user;
}
billingRouter.get("/billing/status", requireAuth, requireRole([ROLE.COACH]), async (req, res, next) => {
    try {
        const env = getEnv();
        if (!isStripeConfigured(env)) {
            return res.json({
                configured: false,
                status: COACH_SUBSCRIPTION_STATUS.INACTIVE,
                hasCustomer: false,
                hasSubscription: false
            });
        }
        const user = await UserModel.findById(req.user.id).lean();
        const coach = getCoachOrThrow(user);
        return res.json({
            configured: true,
            status: coach.subscriptionStatus ?? COACH_SUBSCRIPTION_STATUS.INACTIVE,
            hasCustomer: Boolean(coach.stripeCustomerId),
            hasSubscription: Boolean(coach.stripeSubscriptionId)
        });
    }
    catch (err) {
        return next(err);
    }
});
// Create a Stripe Checkout session for coach subscription.
billingRouter.post("/billing/checkout", requireAuth, requireRole([ROLE.COACH]), async (req, res, next) => {
    try {
        const env = getEnv();
        if (!isStripeConfigured(env)) {
            return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Stripe is not configured" }));
        }
        const plan = String(req.body.plan ?? "monthly");
        const priceId = plan === "annual" ? env.STRIPE_PRICE_ID_ANNUAL : plan === "monthly" ? env.STRIPE_PRICE_ID_MONTHLY : null;
        if (!priceId) {
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid plan" }));
        }
        const stripe = getStripe(env);
        const user = await UserModel.findById(new mongoose.Types.ObjectId(req.user.id));
        const coach = getCoachOrThrow(user);
        // Ensure Stripe customer exists.
        if (!coach.stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: coach.email,
                metadata: { userId: String(coach._id), role: ROLE.COACH }
            });
            coach.stripeCustomerId = customer.id;
            await coach.save();
        }
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: coach.stripeCustomerId,
            allow_promotion_codes: true,
            line_items: [{ price: priceId, quantity: 1 }],
            subscription_data: {
                metadata: { userId: String(coach._id), role: ROLE.COACH }
            },
            metadata: { userId: String(coach._id), role: ROLE.COACH },
            success_url: `${env.WEB_APP_URL}/coach/billing?success=1`,
            cancel_url: `${env.WEB_APP_URL}/coach/billing?canceled=1`
        });
        if (!session.url) {
            return next(new ApiError({ status: 500, code: "INTERNAL_SERVER_ERROR", message: "Missing checkout URL" }));
        }
        return res.json({ url: session.url });
    }
    catch (err) {
        return next(err);
    }
});
// Create a Stripe Billing Portal session (manage subscription)
billingRouter.post("/billing/portal", requireAuth, requireRole([ROLE.COACH]), async (req, res, next) => {
    try {
        const env = getEnv();
        if (!isStripeConfigured(env)) {
            return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Stripe is not configured" }));
        }
        const stripe = getStripe(env);
        const user = await UserModel.findById(new mongoose.Types.ObjectId(req.user.id));
        const coach = getCoachOrThrow(user);
        // If coach was manually toggled active before Stripe existed, create a customer record now.
        if (!coach.stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: coach.email,
                metadata: { userId: String(coach._id), role: ROLE.COACH }
            });
            coach.stripeCustomerId = customer.id;
            await coach.save();
        }
        // Portal is only meaningful if there's a Stripe subscription.
        if (!coach.stripeSubscriptionId) {
            return next(new ApiError({
                status: 409,
                code: "NO_SUBSCRIPTION",
                message: "No Stripe subscription found. Use Upgrade to create one first."
            }));
        }
        const session = await stripe.billingPortal.sessions.create({
            customer: coach.stripeCustomerId,
            return_url: `${env.WEB_APP_URL}/coach/billing`
        });
        return res.json({ url: session.url });
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=billing.js.map