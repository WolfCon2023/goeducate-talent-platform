import mongoose, { Schema } from "mongoose";
const PlayerProfileSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    sport: { type: String, trim: true },
    position: { type: String, required: true, trim: true },
    gradYear: { type: Number, required: true },
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    heightIn: { type: Number },
    weightLb: { type: Number },
    contactEmail: { type: String, lowercase: true, trim: true },
    contactPhone: { type: String, trim: true },
    hudlLink: { type: String }
}, { timestamps: true });
export const PlayerProfileModel = mongoose.models.PlayerProfile ??
    mongoose.model("PlayerProfile", PlayerProfileSchema);
//# sourceMappingURL=PlayerProfile.js.map