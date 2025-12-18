import { Router } from "express";

import { LoginSchema, RegisterSchema, ROLE } from "@goeducate/shared";

import { hashPassword, verifyPassword } from "../auth/password.js";
import { signAccessToken } from "../auth/jwt.js";
import { getEnv } from "../env.js";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { UserModel } from "../models/User.js";

export const authRouter = Router();

authRouter.post("/auth/register", async (req, res, next) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  const { email, password, role } = parsed.data;
  if (role !== ROLE.PLAYER && role !== ROLE.COACH) {
    return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Role is not available for public registration" }));
  }

  try {
    const existing = await UserModel.findOne({ email }).lean();
    if (existing) {
      return next(new ApiError({ status: 409, code: "EMAIL_TAKEN", message: "Email already registered" }));
    }

    const passwordHash = await hashPassword(password);
    const user = await UserModel.create({ email, passwordHash, role });

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


