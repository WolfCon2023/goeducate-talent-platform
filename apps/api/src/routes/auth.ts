import { Router } from "express";

import { LoginSchema, RegisterSchema, ROLE } from "@goeducate/shared";

import { hashPassword, verifyPassword } from "../auth/password.js";
import { signAccessToken } from "../auth/jwt.js";
import { getEnv } from "../env.js";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth } from "../middleware/auth.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
import { UserModel } from "../models/User.js";

export const authRouter = Router();

authRouter.post("/auth/register", async (req, res, next) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  const { email, password, role, firstName, lastName } = parsed.data;
  if (role !== ROLE.PLAYER && role !== ROLE.COACH) {
    return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Role is not available for public registration" }));
  }
  if (role === ROLE.COACH && (!firstName || !lastName)) {
    return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Coach first and last name are required" }));
  }

  try {
    const existing = await UserModel.findOne({ email }).lean();
    if (existing) {
      return next(new ApiError({ status: 409, code: "EMAIL_TAKEN", message: "Email already registered" }));
    }

    const passwordHash = await hashPassword(password);
    const user = await UserModel.create({
      email,
      passwordHash,
      role,
      ...(role === ROLE.COACH ? { firstName, lastName } : {})
    });

    const env = getEnv();
    const token = signAccessToken({ sub: String(user._id), role: user.role }, env.JWT_SECRET);

    return res.status(201).json({
      token,
      user: { id: String(user._id), email: user.email, role: user.role }
    });
  } catch (err) {
    return next(err);
  }
});

authRouter.post("/auth/login", async (req, res, next) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  const { email, password } = parsed.data;

  try {
    const user = await UserModel.findOne({ email });
    if (!user) return next(new ApiError({ status: 401, code: "INVALID_CREDENTIALS", message: "Invalid credentials" }));

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return next(new ApiError({ status: 401, code: "INVALID_CREDENTIALS", message: "Invalid credentials" }));

    const env = getEnv();
    const token = signAccessToken({ sub: String(user._id), role: user.role }, env.JWT_SECRET);

    return res.json({
      token,
      user: { id: String(user._id), email: user.email, role: user.role }
    });
  } catch (err) {
    return next(err);
  }
});

authRouter.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user!.id).lean();
    if (!user) return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Not authenticated" }));

    let displayName: string = user.email;
    if (user.role === ROLE.PLAYER) {
      const profile = await PlayerProfileModel.findOne({ userId: user._id }).lean();
      if (profile?.firstName && profile?.lastName) {
        displayName = `${profile.firstName} ${profile.lastName}`;
      }
    }
    if (user.role === ROLE.COACH && user.firstName && user.lastName) {
      displayName = `${user.firstName} ${user.lastName}`;
    }

    return res.json({
      user: {
        id: String(user._id),
        email: user.email,
        role: user.role,
        displayName
      }
    });
  } catch (err) {
    return next(err);
  }
});


