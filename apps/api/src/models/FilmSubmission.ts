import mongoose, { Schema } from "mongoose";

import { FILM_SUBMISSION_STATUS, type FilmSubmissionStatus } from "@goeducate/shared";

export type FilmSubmissionDoc = {
  userId: mongoose.Types.ObjectId;
  title: string;
  opponent?: string;
  gameDate?: Date;
  notes?: string;
  videoUrl?: string;
  status: FilmSubmissionStatus;
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
    status: {
      type: String,
      required: true,
      enum: Object.values(FILM_SUBMISSION_STATUS),
      default: FILM_SUBMISSION_STATUS.SUBMITTED
    }
  },
  { timestamps: true }
);

FilmSubmissionSchema.index({ userId: 1, createdAt: -1 });

export const FilmSubmissionModel =
  (mongoose.models.FilmSubmission as mongoose.Model<FilmSubmissionDoc> | undefined) ??
  mongoose.model<FilmSubmissionDoc>("FilmSubmission", FilmSubmissionSchema);


