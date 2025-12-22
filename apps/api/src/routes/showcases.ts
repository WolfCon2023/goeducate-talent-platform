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

export const showcasesRouter = Router();

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
  return {
    id: String(s._id),
    slug: s.slug,
    title: s.title,
    description: s.description ?? "",
    refundPolicy: s.refundPolicy ?? "Refund policy: refunds are subject to GoEducate policies (MVP placeholder).",
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


