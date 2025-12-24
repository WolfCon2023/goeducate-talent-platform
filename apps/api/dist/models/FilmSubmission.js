import mongoose, { Schema } from "mongoose";
import { FILM_SUBMISSION_STATUS } from "@goeducate/shared";
const FilmSubmissionSchema = new Schema({
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
}, { timestamps: true });
FilmSubmissionSchema.index({ userId: 1, createdAt: -1 });
FilmSubmissionSchema.index({ assignedEvaluatorUserId: 1, createdAt: 1 });
export const FilmSubmissionModel = mongoose.models.FilmSubmission ??
    mongoose.model("FilmSubmission", FilmSubmissionSchema);
//# sourceMappingURL=FilmSubmission.js.map