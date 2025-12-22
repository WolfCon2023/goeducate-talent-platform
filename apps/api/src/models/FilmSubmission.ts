import mongoose, { Schema } from "mongoose";

import { FILM_SUBMISSION_STATUS, type FilmSubmissionStatus } from "@goeducate/shared";

export type FilmSubmissionDoc = {
  userId: mongoose.Types.ObjectId;
  title: string;
  opponent?: string;
  gameDate?: Date;
  notes?: string;
  videoUrl?: string;
  cloudinaryPublicId?: string;
  status: FilmSubmissionStatus;
  assignedEvaluatorUserId?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  history?: Array<{
    at: Date;
    byUserId?: mongoose.Types.ObjectId;
    action: "created" | "status_changed" | "assigned" | "unassigned";
    fromStatus?: FilmSubmissionStatus;
    toStatus?: FilmSubmissionStatus;
    note?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
};

const FilmSubmissionSchema = new Schema<FilmSubmissionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    opponent: { type: String, trim: true },
    gameDate: { type: Date },
    notes: { type: String },
    videoUrl: { type: String },
    cloudinaryPublicId: { type: String },
    assignedEvaluatorUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    assignedAt: { type: Date },
    status: {
      type: String,
      required: true,
      enum: Object.values(FILM_SUBMISSION_STATUS),
      default: FILM_SUBMISSION_STATUS.SUBMITTED
    },
    history: [
      {
        at: { type: Date, required: true, default: () => new Date() },
        byUserId: { type: Schema.Types.ObjectId, ref: "User" },
        action: { type: String, required: true },
        fromStatus: { type: String },
        toStatus: { type: String },
        note: { type: String }
      }
    ]
  },
  { timestamps: true }
);

FilmSubmissionSchema.index({ userId: 1, createdAt: -1 });
FilmSubmissionSchema.index({ assignedEvaluatorUserId: 1, createdAt: 1 });

export const FilmSubmissionModel =
  (mongoose.models.FilmSubmission as mongoose.Model<FilmSubmissionDoc> | undefined) ??
  mongoose.model<FilmSubmissionDoc>("FilmSubmission", FilmSubmissionSchema);



