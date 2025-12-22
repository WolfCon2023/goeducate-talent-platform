import { Router } from "express";
import mongoose from "mongoose";

import { ROLE, ShowcaseCreateSchema, ShowcaseRegistrationCreateSchema, ShowcaseUpdateSchema } from "@goeducate/shared";

import { getEnv } from "../env.js";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ShowcaseModel, SHOWCASE_STATUS } from "../models/Showcase.js";
import { getStripe } from "../stripe.js";
import { UserModel } from "../models/User.js";
import { ShowcaseRegistrationModel } from "../models/ShowcaseRegistration.js";

export const showcasesRouter = Router();

const DEFAULT_REFUND_POLICY = [
  "Refund Policy",
  "",
  "Effective Date: 12/22/2025",
  "",
  "This Refund Policy governs all showcase registrations processed by GoEducate, Inc. (“GoEducate,” “we,” “us,” or “our”).",
  "",
  "1. General Policy",
  "",
  "All showcase registration fees are non-refundable unless expressly stated otherwise in writing by GoEducate, Inc.",
  "",
  "By completing registration and submitting payment, the registrant acknowledges and agrees that registration fees are earned upon receipt and are subject to the terms of this Refund Policy.",
  "",
  "2. Refund Requests",
  "",
  "Refund requests must be submitted in writing to GoEducate, Inc. no later than seven (7) calendar days prior to the scheduled start date of the showcase. Any approved refund may be subject to administrative and third-party payment processing fees.",
  "",
  "Refund approval is not guaranteed and is granted solely at the discretion of GoEducate, Inc.",
  "",
  "3. Non-Refundable Circumstances",
  "",
  "Refunds will not be issued for, including but not limited to:",
  "",
  "- Failure to attend the showcase for any reason",
  "- Late arrival, early departure, or partial participation",
  "- Personal scheduling conflicts or travel issues",
  "- Disqualification, ineligibility, or failure to meet participation requirements",
  "- Voluntary withdrawal from the event",
  "",
  "4. Medical Exception Requests",
  "",
  "Requests for refunds based on medical emergencies or injuries must be supported by verifiable documentation and will be reviewed on a case-by-case basis. Submission of documentation does not guarantee approval. All determinations are made at the sole discretion of GoEducate, Inc.",
  "",
  "5. Event Cancellation or Modification",
  "",
  "If a showcase is canceled, postponed, or materially modified by GoEducate, Inc., registrants will be offered, at GoEducate’s discretion:",
  "",
  "- A full refund, or",
  "- A credit applicable to a future GoEducate showcase",
  "",
  "Credits are non-transferable and must be used within the timeframe specified at issuance.",
  "",
  "6. Transfers and Credits",
  "",
  "Registration fees are non-transferable to another individual. Credits toward future events may be granted at GoEducate’s discretion and do not carry cash value.",
  "",
  "7. Chargebacks and Payment Disputes (Stripe-Aligned)",
  "",
  "By registering, you agree to contact GoEducate, Inc. prior to initiating any payment dispute or chargeback.",
  "",
  "Initiating a chargeback without first contacting GoEducate may result in:",
  "",
  "- Immediate suspension or termination of your GoEducate account",
  "- Loss of access to GoEducate services",
  "",
  "GoEducate, Inc. reserves the right to submit evidence to payment processors, including but not limited to:",
  "",
  "- Proof of registration and payment confirmation",
  "- Acceptance of the waiver and refund policy",
  "- Event details, schedules, and communications",
  "- Attendance records or event availability",
  "",
  "Chargebacks determined in GoEducate’s favor may result in permanent account restrictions.",
  "",
  "8. Policy Updates",
  "",
  "GoEducate, Inc. reserves the right to amend this Refund Policy at any time. Any updates will apply prospectively and will not affect registrations completed prior to the effective date of the revision.",
  "",
  "By registering for a showcase, you acknowledge that you have read, understand, and agree to this Refund Policy."
].join("\n");

const DEFAULT_WEATHER_CLAUSE = [
  "Weather-Related Event Clause",
  "",
  "Showcase events are scheduled to take place rain or shine.",
  "",
  "Weather conditions, including but not limited to rain, heat, cold, or other natural conditions, do not constitute grounds for a refund unless the event is fully canceled by GoEducate, Inc.",
  "",
  "If weather conditions require cancellation, postponement, or modification of an event, GoEducate, Inc. will determine the appropriate remedy, which may include a refund or credit toward a future event, as outlined in the Refund Policy."
].join("\n");

function computeRegistrationState(s: any, now = new Date()) {
  const status = String(s.status ?? "");
  if (status !== SHOWCASE_STATUS.PUBLISHED) return { status: "closed" as const, label: "Closed" as const };

  const openFlag = Boolean(s.registrationOpen);
  const openAt = s.registrationOpenAt ? new Date(s.registrationOpenAt) : null;
  const closeAt = s.registrationCloseAt ? new Date(s.registrationCloseAt) : null;
  const withinWindow =
    openFlag &&
    (!openAt || openAt.getTime() <= now.getTime()) &&
    (!closeAt || closeAt.getTime() >= now.getTime());

  if (!withinWindow) return { status: "closed" as const, label: "Closed" as const };

  const cap = typeof s.capacity === "number" ? s.capacity : null;
  const remaining = typeof s.spotsRemaining === "number" ? s.spotsRemaining : null;
  if (cap && remaining !== null && remaining <= 0) return { status: "sold_out" as const, label: "Sold Out" as const };
  return { status: "open" as const, label: "Open" as const };
}

function toPublicShowcase(s: any) {
  const reg = computeRegistrationState(s);
  const rawRefund = String(s.refundPolicy ?? "").trim();
  const rawWeather = String(s.weatherClause ?? "").trim();
  const isPlaceholderRefund =
    !rawRefund ||
    rawRefund.includes("[Insert Date]") ||
    rawRefund.toLowerCase().includes("mvp placeholder") ||
    rawRefund.toLowerCase().startsWith("refund policy (attorney-ready version)");
  const isPlaceholderWeather = !rawWeather || rawWeather.toLowerCase().includes("mvp placeholder");

    return {
    id: String(s._id),
    slug: s.slug,
    title: s.title,
    description: s.description ?? "",
    refundPolicy: isPlaceholderRefund ? DEFAULT_REFUND_POLICY : rawRefund,
    weatherClause: isPlaceholderWeather ? DEFAULT_WEATHER_CLAUSE : rawWeather,
    sportCategories: s.sportCategories ?? [],
    startDateTime: s.startDateTime ? new Date(s.startDateTime).toISOString() : null,
    endDateTime: s.endDateTime ? new Date(s.endDateTime).toISOString() : null,
    timezone: s.timezone ?? "America/New_York",
    locationName: s.locationName,
    addressLine1: s.addressLine1,
    addressLine2: s.addressLine2,
    city: s.city,
    state: s.state,
    zip: s.zip,
    costCents: s.costCents ?? 0,
    currency: s.currency ?? "usd",
    capacity: s.capacity,
    spotsRemaining: s.spotsRemaining,
    registrationStatus: reg.status,
    registrationStatusLabel: reg.label,
    imageUrl: s.imageUrl
  };
}

// Public: list published showcases
showcasesRouter.get(
  "/showcases",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (_req, res, next) => {
  try {
    const rows = await ShowcaseModel.find({ status: SHOWCASE_STATUS.PUBLISHED }).sort({ startDateTime: 1 }).lean();
    return res.json({ results: rows.map(toPublicShowcase) });
  } catch (err) {
    return next(err);
  }
  }
);

// Authenticated: list my showcase registrations
showcasesRouter.get(
  "/showcase-registrations/me",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const u = await UserModel.findById(userId).lean();
      const email = String(u?.email ?? "").trim().toLowerCase();

      const match: any = { $or: [{ userId }] };
      if (email) match.$or.push({ email });

      const rows = await ShowcaseRegistrationModel.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $limit: 200 },
        {
          $lookup: {
            from: "showcases",
            localField: "showcaseId",
            foreignField: "_id",
            as: "showcase"
          }
        },
        { $unwind: { path: "$showcase", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            showcaseId: 1,
            fullName: 1,
            email: 1,
            role: 1,
            sport: 1,
            paymentStatus: 1,
            createdAt: 1,
            waiverAcceptedAt: 1,
            waiverVersion: 1,
            refundPolicyAcceptedAt: 1,
            refundPolicyVersion: 1,
            showcase: {
              _id: "$showcase._id",
              slug: "$showcase.slug",
              title: "$showcase.title",
              startDateTime: "$showcase.startDateTime",
              endDateTime: "$showcase.endDateTime",
              city: "$showcase.city",
              state: "$showcase.state",
              locationName: "$showcase.locationName",
              status: "$showcase.status"
            }
          }
        }
      ]);

      return res.json({ results: rows.map((r: any) => ({ ...r, id: String(r._id) })) });
    } catch (err) {
      return next(err);
    }
  }
);

// Admin: list showcase registrations
showcasesRouter.get(
  "/admin/showcase-registrations",
  requireAuth,
  requireRole([ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      const showcaseId = String(req.query.showcaseId ?? "").trim();
      const email = String(req.query.email ?? "").trim().toLowerCase();
      const status = String(req.query.status ?? "").trim();

      const q: any = {};
      if (showcaseId) {
        if (!mongoose.isValidObjectId(showcaseId)) {
          return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid showcaseId" }));
        }
        q.showcaseId = new mongoose.Types.ObjectId(showcaseId);
      }
      if (email) q.email = email;
      if (status) q.paymentStatus = status;

      const rows = await ShowcaseRegistrationModel.aggregate([
        { $match: q },
        { $sort: { createdAt: -1 } },
        { $limit: 500 },
        {
          $lookup: {
            from: "showcases",
            localField: "showcaseId",
            foreignField: "_id",
            as: "showcase"
          }
        },
        { $unwind: { path: "$showcase", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            showcaseId: 1,
            userId: 1,
            fullName: 1,
            email: 1,
            role: 1,
            sport: 1,
            paymentStatus: 1,
            createdAt: 1,
            stripeCheckoutSessionId: 1,
            stripePaymentIntentId: 1,
            waiverAcceptedAt: 1,
            waiverVersion: 1,
            refundPolicyAcceptedAt: 1,
            refundPolicyVersion: 1,
            showcase: {
              _id: "$showcase._id",
              slug: "$showcase.slug",
              title: "$showcase.title",
              startDateTime: "$showcase.startDateTime",
              endDateTime: "$showcase.endDateTime",
              city: "$showcase.city",
              state: "$showcase.state",
              locationName: "$showcase.locationName",
              status: "$showcase.status"
            }
          }
        }
      ]);

      return res.json({ results: rows.map((r: any) => ({ ...r, id: String(r._id) })) });
    } catch (err) {
      return next(err);
    }
  }
);

// Public: get showcase by id or slug
showcasesRouter.get(
  "/showcases/:idOrSlug",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
  try {
    const idOrSlug = String(req.params.idOrSlug ?? "").trim();
    const q = mongoose.isValidObjectId(idOrSlug) ? { _id: new mongoose.Types.ObjectId(idOrSlug) } : { slug: idOrSlug.toLowerCase() };
    const row = await ShowcaseModel.findOne(q).lean();
    if (!row || row.status !== SHOWCASE_STATUS.PUBLISHED) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Showcase not found" }));
    }
    return res.json(toPublicShowcase(row));
  } catch (err) {
    return next(err);
  }
  }
);

// Public (or authed): start registration checkout session
showcasesRouter.post(
  "/showcases/:idOrSlug/register",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
  try {
    const env = getEnv();
    if (!env.STRIPE_SECRET_KEY || !env.WEB_APP_URL) {
      return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Stripe is not configured" }));
    }

    const idOrSlug = String(req.params.idOrSlug ?? "").trim();
    const q = mongoose.isValidObjectId(idOrSlug) ? { _id: new mongoose.Types.ObjectId(idOrSlug) } : { slug: idOrSlug.toLowerCase() };
    const showcase = await ShowcaseModel.findOne(q).lean();
    if (!showcase || showcase.status !== SHOWCASE_STATUS.PUBLISHED) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Showcase not found" }));
    }

    const regState = computeRegistrationState(showcase);
    if (regState.status !== "open") {
      return next(new ApiError({ status: 409, code: "REGISTRATION_CLOSED", message: "Registration is not open" }));
    }

    if (!showcase.stripePriceId) {
      return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Showcase Stripe price is not configured" }));
    }

    const parsed = ShowcaseRegistrationCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

    // If logged in, use stored email.
    let customerEmail = parsed.data.email.trim().toLowerCase();
    let fullName = parsed.data.fullName.trim();
    let role = parsed.data.role;
    let sport = parsed.data.sport;
    const waiverVersion = parsed.data.waiverVersion ?? "v1";
    const waiverAcceptedAtIso = new Date().toISOString();
    const refundPolicyVersion = parsed.data.refundPolicyVersion ?? "v1";
    const refundPolicyAcceptedAtIso = new Date().toISOString();

    const userId = req.user?.id;
    if (userId && mongoose.isValidObjectId(userId)) {
      const u = await UserModel.findById(userId).lean();
      if (u?.email) customerEmail = String(u.email).toLowerCase();
      if (u?.role) role = u.role;
    }

    const stripe = getStripe(env);
    const baseUrl = env.WEB_APP_URL.replace(/\/+$/, "");
    const showcaseSlug = String(showcase.slug ?? idOrSlug);
    const successUrl = `${baseUrl}/showcases/${encodeURIComponent(showcaseSlug)}?success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/showcases/${encodeURIComponent(showcaseSlug)}?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      customer_email: customerEmail,
      line_items: [{ price: showcase.stripePriceId, quantity: 1 }],
      metadata: {
        kind: "showcase_registration",
        showcaseId: String(showcase._id),
        showcaseSlug: String(showcase.slug),
        fullName,
        email: customerEmail,
        waiverAcceptedAt: waiverAcceptedAtIso,
        waiverVersion,
        refundPolicyAcceptedAt: refundPolicyAcceptedAtIso,
        refundPolicyVersion,
        ...(role ? { role: String(role) } : {}),
        ...(sport ? { sport: String(sport) } : {}),
        ...(userId ? { userId } : {})
      },
      success_url: successUrl,
      cancel_url: cancelUrl
    });

    if (!session.url) {
      return next(new ApiError({ status: 500, code: "INTERNAL_SERVER_ERROR", message: "Missing checkout URL" }));
    }
    return res.json({ url: session.url });
  } catch (err) {
    return next(err);
  }
  }
);

// Admin: list all showcases (draft/published/archived)
showcasesRouter.get("/admin/showcases", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const status = String(req.query.status ?? "").trim();
    const sport = String(req.query.sport ?? "").trim();
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();

    const q: any = {};
    if (status) q.status = status;
    if (sport) q.sportCategories = sport;
    if (from || to) {
      q.startDateTime = {};
      if (from) q.startDateTime.$gte = new Date(from);
      if (to) q.startDateTime.$lte = new Date(to);
    }

    const rows = await ShowcaseModel.find(q).sort({ startDateTime: -1 }).limit(500).lean();
    return res.json({ results: rows.map((s) => ({ ...toPublicShowcase(s), status: s.status, stripePriceId: s.stripePriceId })) });
  } catch (err) {
    return next(err);
  }
});

// Admin: create
showcasesRouter.post("/admin/showcases", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  const parsed = ShowcaseCreateSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));
  try {
    const data = parsed.data;
    const existing = await ShowcaseModel.findOne({ slug: data.slug }).lean();
    if (existing) return next(new ApiError({ status: 409, code: "SLUG_TAKEN", message: "Slug already exists" }));

    const doc = await ShowcaseModel.create({
      ...data,
      startDateTime: new Date(data.startDateTime),
      endDateTime: new Date(data.endDateTime),
      registrationOpenAt: data.registrationOpenAt ? new Date(data.registrationOpenAt) : undefined,
      registrationCloseAt: data.registrationCloseAt ? new Date(data.registrationCloseAt) : undefined,
      createdBy: new mongoose.Types.ObjectId(req.user!.id as any),
      ...(data.capacity !== undefined && data.spotsRemaining === undefined ? { spotsRemaining: data.capacity } : {})
    });
    return res.status(201).json({ showcase: toPublicShowcase(doc.toObject()) });
  } catch (err) {
    return next(err);
  }
});

// Admin: update
showcasesRouter.put("/admin/showcases/:id", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  const parsed = ShowcaseUpdateSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.isValidObjectId(id)) return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid id" }));

    if (parsed.data.slug) {
      const existing = await ShowcaseModel.findOne({ slug: parsed.data.slug, _id: { $ne: new mongoose.Types.ObjectId(id) } }).lean();
      if (existing) return next(new ApiError({ status: 409, code: "SLUG_TAKEN", message: "Slug already exists" }));
    }

    const update: any = { ...parsed.data };
    if (parsed.data.startDateTime) update.startDateTime = new Date(parsed.data.startDateTime);
    if (parsed.data.endDateTime) update.endDateTime = new Date(parsed.data.endDateTime);
    if (parsed.data.registrationOpenAt) update.registrationOpenAt = new Date(parsed.data.registrationOpenAt);
    if (parsed.data.registrationCloseAt) update.registrationCloseAt = new Date(parsed.data.registrationCloseAt);

    const updated = await ShowcaseModel.findByIdAndUpdate(new mongoose.Types.ObjectId(id), update, { new: true }).lean();
    if (!updated) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Showcase not found" }));
    return res.json({ showcase: { ...toPublicShowcase(updated), status: updated.status, stripePriceId: updated.stripePriceId } });
  } catch (err) {
    return next(err);
  }
});

// Admin: delete (archive)
showcasesRouter.delete("/admin/showcases/:id", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.isValidObjectId(id)) return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid id" }));
    const updated = await ShowcaseModel.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      { $set: { status: SHOWCASE_STATUS.ARCHIVED, registrationOpen: false } },
      { new: true }
    ).lean();
    if (!updated) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Showcase not found" }));
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});


