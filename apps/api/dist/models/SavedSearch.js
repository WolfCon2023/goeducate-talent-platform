import mongoose, { Schema } from "mongoose";
const SavedSearchSchema = new Schema({
    coachUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    params: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true });
SavedSearchSchema.index({ coachUserId: 1, name: 1 }, { unique: true });
export const SavedSearchModel = mongoose.models.SavedSearch ??
    mongoose.model("SavedSearch", SavedSearchSchema);
//# sourceMappingURL=SavedSearch.js.map