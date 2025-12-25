import { Router } from "express";
import mongoose from "mongoose";
import { ROLE } from "@goeducate/shared";
import { getEnv } from "../env.js";
import { ApiError } from "../http/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { COACH_SUBSCRIPTION_STATUS, UserModel } from "../models/User.js";
import { getStripe, isStripeConfigured } from "../stripe.js";
import { logAppEvent } from "../util/appEvents.js";
import { APP_EVENT_TYPE } from "../models/AppEvent.js";
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
                hasSubscription: false,
                plan: null,
                renewalDate: null,
                subscriptionId: null,
                downgradeScheduled: false
            });
        }
        const stripe = getStripe(env);
        const user = await UserModel.findById(new mongoose.Types.ObjectId(req.user.id));
        const coach = getCoachOrThrow(user);
        // Default to stored values; we may override with Stripe truth below.
        let effectiveHasSubscription = Boolean(coach.stripeSubscriptionId);
        let effectiveStatus = coach.subscriptionStatus ?? COACH_SUBSCRIPTION_STATUS.INACTIVE;
        let plan = null;
        let renewalDate = null;
        let subscriptionId = coach.stripeSubscriptionId ?? null;
        let downgradeScheduled = false;
        // If we have a customer, ask Stripe for the active subscription so we can show plan type and avoid duplicates.
        if (coach.stripeCustomerId) {
            try {
                const subs = await stripe.subscriptions.list({ customer: coach.stripeCustomerId, status: "all", limit: 10 });
                const active = subs.data.find((s) => ["active", "trialing", "past_due"].includes(String(s.status)));
                if (active) {
                    effectiveHasSubscription = true;
                    effectiveStatus = COACH_SUBSCRIPTION_STATUS.ACTIVE;
                    subscriptionId = active.id;
                    const renewalTs = typeof active.current_period_end === "number" ? active.current_period_end : null;
                    renewalDate = renewalTs ? new Date(renewalTs * 1000).toISOString() : null;
                    const priceId = active.items?.data?.[0]?.price?.id ?? null;
                    const interval = active.items?.data?.[0]?.price?.recurring?.interval ?? null;
                    if (priceId && priceId === env.STRIPE_PRICE_ID_MONTHLY)
                        plan = "monthly";
                    else if (priceId && priceId === env.STRIPE_PRICE_ID_ANNUAL)
                        plan = "annual";
                    else if (interval === "month")
                        plan = "monthly";
                    else if (interval === "year")
                        plan = "annual";
                    else
                        plan = "unknown";
                    // If there is a schedule, detect if a downgrade to monthly is already scheduled for renewal.
                    try {
                        const renewalTs = typeof active.current_period_end === "number" ? active.current_period_end : null;
                        const scheduleId = active.schedule && typeof active.schedule === "string"
                            ? active.schedule
                            : active.schedule?.id ?? null;
                        if (scheduleId && renewalTs) {
                            const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
                            const scheduledPhase = schedule.phases?.find((p) => p.start_date === renewalTs);
                            const scheduledPriceId = scheduledPhase?.items?.[0]?.price ?? null;
                            if (scheduledPriceId && scheduledPriceId === env.STRIPE_PRICE_ID_MONTHLY) {
                                downgradeScheduled = true;
                            }
                        }
                    }
                    catch (err) {
                        console.error("[billing] failed to inspect subscription schedule", err);
                    }
                    // Best-effort: keep our DB in sync so other endpoints (portal) work reliably.
                    if (!coach.stripeSubscriptionId || coach.stripeSubscriptionId !== active.id) {
                        coach.stripeSubscriptionId = active.id;
                    }
                    coach.subscriptionStatus = COACH_SUBSCRIPTION_STATUS.ACTIVE;
                    await coach.save();
                }
                else {
                    // No active Stripe subscription found. Keep stored status if it was manually set.
                    if (coach.subscriptionStatus !== COACH_SUBSCRIPTION_STATUS.ACTIVE) {
                        effectiveStatus = COACH_SUBSCRIPTION_STATUS.INACTIVE;
                    }
                    else {
                        // Manually toggled active (or legacy state) with no Stripe subscription found.
                        // Treat as subscribed to avoid duplicate billing; plan/renewal may be unknown.
                        effectiveHasSubscription = true;
                        plan = plan ?? "unknown";
                    }
                }
            }
            catch (err) {
                console.error("[billing] failed to load Stripe subscription status", err);
                // Fall back to stored values.
            }
        }
        else if (effectiveStatus === COACH_SUBSCRIPTION_STATUS.ACTIVE) {
            // Manually toggled active with no Stripe record; plan unknown.
            plan = "unknown";
            effectiveHasSubscription = true;
        }
        // Final safety: if marked active, don't allow the UI to offer "Upgrade" (duplicate billing risk).
        if (effectiveStatus === COACH_SUBSCRIPTION_STATUS.ACTIVE && !effectiveHasSubscription) {
            effectiveHasSubscription = true;
            plan = plan ?? "unknown";
        }
        return res.json({
            configured: true,
            status: effectiveStatus,
            hasCustomer: Boolean(coach.stripeCustomerId),
            hasSubscription: effectiveHasSubscription,
            plan,
            renewalDate,
            subscriptionId,
            downgradeScheduled
        });
    }
    catch (err) {
        return next(err);
    }
});
// Robust downgrade: if coach is currently on annual, schedule the change to monthly at renewal date.
billingRouter.post("/billing/downgrade-monthly", requireAuth, requireRole([ROLE.COACH]), async (req, res, next) => {
    try {
        const env = getEnv();
        if (!isStripeConfigured(env)) {
            return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Stripe is not configured" }));
        }
        const stripe = getStripe(env);
        const user = await UserModel.findById(new mongoose.Types.ObjectId(req.user.id));
        const coach = getCoachOrThrow(user);
        if (!coach.stripeCustomerId) {
            return next(new ApiError({ status: 409, code: "NO_CUSTOMER", message: "No Stripe customer found." }));
        }
        const subs = await stripe.subscriptions.list({ customer: coach.stripeCustomerId, status: "all", limit: 10 });
        const active = subs.data.find((s) => ["active", "trialing", "past_due"].includes(String(s.status)));
        if (!active) {
            return next(new ApiError({ status: 409, code: "NO_SUBSCRIPTION", message: "No active Stripe subscription found." }));
        }
        const currentPriceId = active.items?.data?.[0]?.price?.id ?? null;
        const currentInterval = active.items?.data?.[0]?.price?.recurring?.interval ?? null;
        const isAnnual = (currentPriceId && currentPriceId === env.STRIPE_PRICE_ID_ANNUAL) || (!currentPriceId && currentInterval === "year") || currentInterval === "year";
        const isMonthly = (currentPriceId && currentPriceId === env.STRIPE_PRICE_ID_MONTHLY) || (!currentPriceId && currentInterval === "month") || currentInterval === "month";
        const renewalTs = typeof active.current_period_end === "number" ? active.current_period_end : null;
        if (isMonthly) {
            return res.json({
                scheduled: false,
                alreadyScheduled: false,
                effectiveDate: renewalTs ? new Date(renewalTs * 1000).toISOString() : null,
                message: "You are already on a monthly plan."
            });
        }
        if (!isAnnual) {
            return next(new ApiError({
                status: 409,
                code: "UNSUPPORTED_PLAN",
                message: "Unable to schedule downgrade because your current plan could not be identified as annual."
            }));
        }
        const monthlyPriceId = env.STRIPE_PRICE_ID_MONTHLY;
        if (!monthlyPriceId) {
            return next(new ApiError({ status: 500, code: "MISSING_PRICE", message: "Missing STRIPE_PRICE_ID_MONTHLY" }));
        }
        if (!renewalTs) {
            return next(new ApiError({ status: 500, code: "MISSING_RENEWAL", message: "Missing subscription renewal date" }));
        }
        // If schedule exists, check if monthly is already scheduled at renewal.
        const existingScheduleId = active.schedule && typeof active.schedule === "string"
            ? active.schedule
            : active.schedule?.id ?? null;
        if (existingScheduleId) {
            const schedule = await stripe.subscriptionSchedules.retrieve(existingScheduleId);
            const scheduledPhase = schedule.phases?.find((p) => p.start_date === renewalTs);
            const scheduledPriceId = scheduledPhase?.items?.[0]?.price ?? null;
            if (scheduledPriceId && scheduledPriceId === monthlyPriceId) {
                return res.json({
                    scheduled: true,
                    alreadyScheduled: true,
                    effectiveDate: new Date(renewalTs * 1000).toISOString(),
                    message: "Downgrade to monthly is already scheduled for your renewal date."
                });
            }
        }
        // Create a schedule from the current subscription if needed.
        const schedule = existingScheduleId != null
            ? await stripe.subscriptionSchedules.retrieve(existingScheduleId)
            : await stripe.subscriptionSchedules.create({ from_subscription: active.id });
        const currentPhaseStart = typeof active.current_period_start === "number"
            ? active.current_period_start
            : Math.floor(Date.now() / 1000);
        const currentPhaseEnd = renewalTs;
        // Update the schedule to keep current annual plan until renewal, then switch to monthly.
        const updated = await stripe.subscriptionSchedules.update(schedule.id, {
            end_behavior: "release",
            phases: [
                {
                    start_date: currentPhaseStart,
                    end_date: currentPhaseEnd,
                    items: [{ price: currentPriceId ?? env.STRIPE_PRICE_ID_ANNUAL, quantity: 1 }]
                },
                {
                    start_date: currentPhaseEnd,
                    items: [{ price: monthlyPriceId, quantity: 1 }]
                }
            ]
        });
        return res.json({
            scheduled: true,
            alreadyScheduled: false,
            effectiveDate: new Date(renewalTs * 1000).toISOString(),
            scheduleId: updated.id,
            message: "Downgrade scheduled for your renewal date."
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
        logAppEvent({
            type: APP_EVENT_TYPE.COACH_CHECKOUT_STARTED,
            user: req.user,
            path: req.path,
            meta: { plan, priceId }
        });
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
        logAppEvent({
            type: APP_EVENT_TYPE.COACH_BILLING_PORTAL_OPENED,
            user: req.user,
            path: req.path,
            meta: { customerId: coach.stripeCustomerId }
        });
        return res.json({ url: session.url });
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=billing.js.map