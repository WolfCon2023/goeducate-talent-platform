import crypto from "crypto";
import mongoose, { Schema } from "mongoose";

import { ALL_ROLES, type Role } from "@goeducate/shared";

export type EvaluatorInviteDoc = {
  email: string;
  role: Role; // invited role (player/coach/evaluator/admin)
  tokenHash: string;
  createdByUserId: mongoose.Types.ObjectId;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const EvaluatorInviteSchema = new Schema<EvaluatorInviteDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, required: true, enum: ALL_ROLES },
    tokenHash: { type: String, required: true, unique: true, index: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date }
  },
  { timestamps: true }
);

EvaluatorInviteSchema.index({ email: 1, usedAt: 1 });

export function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

export const EvaluatorInviteModel =
  (mongoose.models.EvaluatorInvite as mongoose.Model<EvaluatorInviteDoc> | undefined) ??
  mongoose.model<EvaluatorInviteDoc>("EvaluatorInvite", EvaluatorInviteSchema);


