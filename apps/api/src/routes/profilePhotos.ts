import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";

import { ROLE } from "@goeducate/shared";

import { getEnv } from "../env.js";
import { ApiError } from "../http/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { UserModel } from "../models/User.js";

export const profilePhotosRouter = Router();

function getUploadsRoot() {
  const env = getEnv();
  const root = env.UPLOADS_DIR ? path.resolve(env.UPLOADS_DIR) : path.resolve(process.cwd(), "uploads");
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function getProfilePhotosDir() {
  const root = getUploadsRoot();
  const dir = path.join(root, "profile-photos");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, getProfilePhotosDir());
      } catch (err) {
        cb(err as Error, "");
      }
    },
    filename: (_req, file, cb) => {
      const orig = String(file.originalname ?? "");
      const ext = path.extname(orig).slice(0, 12).toLowerCase();
      const safeExt = ext && ext.length <= 6 ? ext : "";
      const name = `${crypto.randomUUID()}${safeExt}`;
      cb(null, name);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype ?? "");
    if (!mime.startsWith("image/")) return cb(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Only image uploads are allowed" }));
    cb(null, true);
  }
});

// Player/Coach: upload a profile photo.
// Returns a public URL served by the API at /uploads/...
profilePhotosRouter.post(
  "/users/me/profile-photo",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH]),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Missing file" }));

      const relPath = `profile-photos/${file.filename}`;

      // Best-effort: remove previous photo
      const user = await UserModel.findById(req.user!.id);
      if (!user) return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Not authenticated" }));

      const prev = user.profilePhotoPath ? String(user.profilePhotoPath) : "";
      user.profilePhotoPath = relPath;
      await user.save();

      if (prev && prev.startsWith("profile-photos/")) {
        const prevAbs = path.join(getUploadsRoot(), prev);
        fs.promises.unlink(prevAbs).catch(() => {});
      }

      return res.json({
        ok: true,
        profilePhotoUrl: `/uploads/${relPath}`
      });
    } catch (err) {
      return next(err);
    }
  }
);


