import mongoose, { Schema } from "mongoose";
export const SHOWCASE_STATUS = {
    DRAFT: "draft",
    PUBLISHED: "published",
    ARCHIVED: "archived"
};
const ShowcaseSchema = new Schema({
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    waiverText: {
        type: String,
        default: "By registering for and participating in this GoEducate showcase event, you acknowledge and agree to the following:\n\nParticipation in athletic showcase events involves physical activity that may carry inherent risks, including but not limited to physical injury, illness, or other harm. You voluntarily choose to participate and assume full responsibility for any risks associated with attendance and participation.\n\nYou agree to release, waive, and hold harmless GoEducate, Inc., its officers, employees, representatives, and agents from any and all claims, liabilities, damages, or losses arising from or related to participation in this showcase, except as required by law.\n\nYou confirm that you are physically capable of participating and that you have not been advised otherwise by a medical professional. If the participant is a minor, you confirm that you are the parent or legal guardian and consent to the minor’s participation.\n\nYou acknowledge that this is a waiver placeholder and that a more detailed legal waiver may be required prior to or at the event.\n\nBy checking the box below, you confirm that you have read, understand, and agree to this waiver."
    },
    waiverVersion: { type: String, default: "v1", trim: true },
    refundPolicy: {
        type: String,
        default: "Refund Policy\n\nEffective Date: 12/22/2025\n\nThis Refund Policy governs all showcase registrations processed by GoEducate, Inc. (“GoEducate,” “we,” “us,” or “our”).\n\n1. General Policy\n\nAll showcase registration fees are non-refundable unless expressly stated otherwise in writing by GoEducate, Inc.\n\nBy completing registration and submitting payment, the registrant acknowledges and agrees that registration fees are earned upon receipt and are subject to the terms of this Refund Policy.\n\n2. Refund Requests\n\nRefund requests must be submitted in writing to GoEducate, Inc. no later than seven (7) calendar days prior to the scheduled start date of the showcase. Any approved refund may be subject to administrative and third-party payment processing fees.\n\nRefund approval is not guaranteed and is granted solely at the discretion of GoEducate, Inc.\n\n3. Non-Refundable Circumstances\n\nRefunds will not be issued for, including but not limited to:\n\n- Failure to attend the showcase for any reason\n- Late arrival, early departure, or partial participation\n- Personal scheduling conflicts or travel issues\n- Disqualification, ineligibility, or failure to meet participation requirements\n- Voluntary withdrawal from the event\n\n4. Medical Exception Requests\n\nRequests for refunds based on medical emergencies or injuries must be supported by verifiable documentation and will be reviewed on a case-by-case basis. Submission of documentation does not guarantee approval. All determinations are made at the sole discretion of GoEducate, Inc.\n\n5. Event Cancellation or Modification\n\nIf a showcase is canceled, postponed, or materially modified by GoEducate, Inc., registrants will be offered, at GoEducate’s discretion:\n\n- A full refund, or\n- A credit applicable to a future GoEducate showcase\n\nCredits are non-transferable and must be used within the timeframe specified at issuance.\n\n6. Transfers and Credits\n\nRegistration fees are non-transferable to another individual. Credits toward future events may be granted at GoEducate’s discretion and do not carry cash value.\n\n7. Chargebacks and Payment Disputes (Stripe-Aligned)\n\nBy registering, you agree to contact GoEducate, Inc. prior to initiating any payment dispute or chargeback.\n\nInitiating a chargeback without first contacting GoEducate may result in:\n\n- Immediate suspension or termination of your GoEducate account\n- Loss of access to GoEducate services\n\nGoEducate, Inc. reserves the right to submit evidence to payment processors, including but not limited to:\n\n- Proof of registration and payment confirmation\n- Acceptance of the waiver and refund policy\n- Event details, schedules, and communications\n- Attendance records or event availability\n\nChargebacks determined in GoEducate’s favor may result in permanent account restrictions.\n\n8. Policy Updates\n\nGoEducate, Inc. reserves the right to amend this Refund Policy at any time. Any updates will apply prospectively and will not affect registrations completed prior to the effective date of the revision.\n\nBy registering for a showcase, you acknowledge that you have read, understand, and agree to this Refund Policy."
    },
    refundPolicyVersion: { type: String, default: "v1", trim: true },
    weatherClause: {
        type: String,
        default: "Weather-Related Event Clause\n\nShowcase events are scheduled to take place rain or shine.\n\nWeather conditions, including but not limited to rain, heat, cold, or other natural conditions, do not constitute grounds for a refund unless the event is fully canceled by GoEducate, Inc.\n\nIf weather conditions require cancellation, postponement, or modification of an event, GoEducate, Inc. will determine the appropriate remedy, which may include a refund or credit toward a future event, as outlined in the Refund Policy."
    },
    weatherClauseVersion: { type: String, default: "v1", trim: true },
    sportCategories: { type: [String], required: true, default: [] },
    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },
    timezone: { type: String, required: true, default: "America/New_York", trim: true },
    locationName: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    zip: { type: String, trim: true },
    costCents: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "usd", trim: true },
    capacity: { type: Number, min: 1 },
    spotsRemaining: { type: Number, min: 0 },
    registrationOpen: { type: Boolean, required: true, default: false },
    registrationOpenAt: { type: Date },
    registrationCloseAt: { type: Date },
    status: { type: String, required: true, enum: Object.values(SHOWCASE_STATUS), default: SHOWCASE_STATUS.DRAFT },
    imageUrl: { type: String, trim: true },
    stripePriceId: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }
}, { timestamps: true });
ShowcaseSchema.index({ status: 1, startDateTime: 1 });
ShowcaseSchema.index({ registrationOpen: 1, registrationOpenAt: 1, registrationCloseAt: 1 });
export const ShowcaseModel = mongoose.models.Showcase ?? mongoose.model("Showcase", ShowcaseSchema);
//# sourceMappingURL=Showcase.js.map