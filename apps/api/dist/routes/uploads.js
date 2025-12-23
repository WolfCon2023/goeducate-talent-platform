import { Router } from "express";
import { v2 as cloudinary } from "cloudinary";
import { ROLE } from "@goeducate/shared";
import { ApiError } from "../http/errors.js";
import { getEnv } from "../env.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
export const uploadsRouter = Router();
// Player: get signed params for direct-to-Cloudinary upload.
// The browser uploads the actual file directly to Cloudinary.
uploadsRouter.post("/uploads/cloudinary/sign", requireAuth, requireRole([ROLE.PLAYER]), async (req, res, next) => {
    try {
        const env = getEnv();
        const cloudName = env.CLOUDINARY_CLOUD_NAME;
        const apiKey = env.CLOUDINARY_API_KEY;
        const apiSecret = env.CLOUDINARY_API_SECRET;
        if (!cloudName || !apiKey || !apiSecret) {
            return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Uploads not configured" }));
        }
        cloudinary.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret
        });
        const folder = env.CLOUDINARY_FOLDER ?? "goeducate-talent/films";
        const timestamp = Math.floor(Date.now() / 1000);
        // Optional client hints. We don't trust these for security; they're for UX.
        const resourceType = String(req.body.resourceType ?? "video");
        const paramsToSign = {
            folder,
            timestamp
        };
        const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
        return res.json({
            cloudName,
            apiKey,
            resourceType,
            folder,
            timestamp,
            signature
        });
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=uploads.js.map