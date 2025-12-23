import { Router } from "express";
import mongoose from "mongoose";
import { EvaluationFormCreateSchema, EvaluationFormDefinitionSchema, EvaluationFormUpdateSchema, ROLE } from "@goeducate/shared";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { EvaluationFormModel } from "../models/EvaluationForm.js";
export const evaluationFormsRouter = Router();
const DEFAULT_FORM_VERSION = 2;
function normalizeSport(input) {
    const s = String(input ?? "").trim().toLowerCase();
    return s === "football" || s === "basketball" || s === "volleyball" || s === "soccer" || s === "track" || s === "other"
        ? s
        : "other";
}
function isSystemDefaultForm(doc) {
    // Heuristic: defaults are created by the system (no createdByUserId) and have the "Default ..." title.
    const title = String(doc?.title ?? "");
    return title.toLowerCase().startsWith("default ") && !doc?.createdByUserId;
}
function defaultFormForSport(sport) {
    const normalized = normalizeSport(sport);
    const LABELS = {
        football: {
            physical: ["Size / frame", "Functional strength", "Contact balance / play strength", "Body control"],
            athletic: ["Play speed", "Acceleration", "Change of direction", "Explosiveness"],
            technical: ["Position technique fundamentals", "Footwork", "Hand usage / skill execution", "Consistency (rep-to-rep)"],
            mental: ["Processing (speed of play)", "Decision-making", "Situational awareness", "Adaptability / learning"],
            intangibles: ["Motor / effort", "Competitiveness", "Coachability indicators", "Leadership / communication"]
        },
        basketball: {
            physical: ["Size / frame", "Functional strength", "Contact balance / physicality", "Body control"],
            athletic: ["Speed / pace", "First step / acceleration", "Lateral agility", "Explosiveness / vertical pop"],
            technical: ["Handle / ball security", "Shooting mechanics", "Finishing / shot creation", "Defensive technique"],
            mental: ["Court awareness / IQ", "Decision speed", "Spacing / off-ball instincts", "Adaptability / learning"],
            intangibles: ["Motor / effort", "Competitiveness", "Coachability indicators", "Leadership / communication"]
        },
        volleyball: {
            physical: ["Size / frame", "Functional strength", "Durability / resiliency", "Body control"],
            athletic: ["Quickness", "Approach acceleration", "Lateral agility", "Explosiveness / jump"],
            technical: ["Serve / serve pressure", "Serve receive / passing", "Attack mechanics (arm swing)", "Block timing / positioning"],
            mental: ["Reading / anticipation", "Decision-making", "Court awareness", "Adaptability / learning"],
            intangibles: ["Motor / effort", "Competitiveness", "Coachability indicators", "Leadership / communication"]
        },
        soccer: {
            physical: ["Size / frame", "Functional strength", "Balance under contact", "Body control"],
            athletic: ["Speed", "Acceleration", "Agility / change of direction", "Explosiveness"],
            technical: ["First touch", "Passing / receiving", "1v1 defending / technique", "Finishing / end product"],
            mental: ["Scanning / awareness", "Decision-making", "Positioning / tactics", "Adaptability / learning"],
            intangibles: ["Motor / work rate", "Competitiveness", "Coachability indicators", "Leadership / communication"]
        },
        track: {
            physical: ["Frame / leverages", "Strength (general)", "Durability / injury risk", "Body control / mechanics"],
            athletic: ["Speed", "Acceleration / start", "Elasticity / reactivity", "Explosiveness"],
            technical: ["Event mechanics", "Form efficiency", "Rhythm / cadence", "Execution / consistency"],
            mental: ["Race strategy", "Focus / composure", "Competitiveness", "Adaptability / learning"],
            intangibles: ["Work ethic", "Coachability", "Resilience", "Leadership / communication"]
        },
        other: {
            physical: ["Size / frame", "Functional strength", "Durability / resiliency", "Body control"],
            athletic: ["Speed", "Acceleration", "Agility / change of direction", "Explosiveness"],
            technical: ["Technique fundamentals", "Footwork", "Execution / skill application", "Consistency (rep-to-rep)"],
            mental: ["Processing / speed of play", "Decision-making", "Situational awareness", "Adaptability / learning"],
            intangibles: ["Motor / effort", "Competitiveness", "Coachability indicators", "Leadership / communication"]
        }
    };
    const L = LABELS[normalized];
    const base = {
        title: `Default ${normalized} evaluation form`,
        sport: normalized,
        isActive: true,
        version: DEFAULT_FORM_VERSION,
        strengthsPrompt: "Provide 2–4 strengths with specific evidence (what you saw and where). Use bullet points.\n- Strength 1 (evidence)\n- Strength 2 (evidence)",
        improvementsPrompt: "Provide 2–4 improvements with actionable coaching points. Use bullet points.\n- Improvement 1 (how to improve)\n- Improvement 2 (how to improve)",
        notesHelp: "Optional: leave any additional context, caveats, or timecodes.",
        categories: [
            {
                key: "physical",
                label: "Physical",
                weight: 20,
                traits: [
                    { key: "size_frame", label: L.physical[0], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "strength", label: L.physical[1], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "durability", label: L.physical[2], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    {
                        key: "body_control",
                        label: L.physical[3],
                        type: "slider",
                        required: true,
                        min: 1,
                        max: 10,
                        step: 1
                    },
                    {
                        key: "physical_confidence",
                        label: "Confidence (physical assessment)",
                        type: "select",
                        required: true,
                        options: [
                            { value: "low", label: "Low", score: 4 },
                            { value: "medium", label: "Medium", score: 6 },
                            { value: "high", label: "High", score: 8 }
                        ]
                    }
                ]
            },
            {
                key: "athletic",
                label: "Athletic",
                weight: 20,
                traits: [
                    { key: "speed", label: L.athletic[0], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "acceleration", label: L.athletic[1], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "agility", label: L.athletic[2], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "explosiveness", label: L.athletic[3], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    {
                        key: "athletic_confidence",
                        label: "Confidence (athletic assessment)",
                        type: "select",
                        required: true,
                        options: [
                            { value: "low", label: "Low", score: 4 },
                            { value: "medium", label: "Medium", score: 6 },
                            { value: "high", label: "High", score: 8 }
                        ]
                    }
                ]
            },
            {
                key: "technical",
                label: "Technical",
                weight: 25,
                traits: [
                    { key: "technique", label: L.technical[0], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "footwork", label: L.technical[1], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "execution", label: L.technical[2], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "consistency", label: L.technical[3], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    {
                        key: "technical_confidence",
                        label: "Confidence (technical assessment)",
                        type: "select",
                        required: true,
                        options: [
                            { value: "low", label: "Low", score: 4 },
                            { value: "medium", label: "Medium", score: 6 },
                            { value: "high", label: "High", score: 8 }
                        ]
                    }
                ]
            },
            {
                key: "mental",
                label: "Mental",
                weight: 20,
                traits: [
                    { key: "processing", label: L.mental[0], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "decision_making", label: L.mental[1], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "awareness", label: L.mental[2], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "adaptability", label: L.mental[3], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    {
                        key: "mental_confidence",
                        label: "Confidence (mental assessment)",
                        type: "select",
                        required: true,
                        options: [
                            { value: "low", label: "Low", score: 4 },
                            { value: "medium", label: "Medium", score: 6 },
                            { value: "high", label: "High", score: 8 }
                        ]
                    }
                ]
            },
            {
                key: "intangibles",
                label: "Intangibles",
                weight: 15,
                traits: [
                    { key: "motor", label: L.intangibles[0], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "competitiveness", label: L.intangibles[1], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "coachability", label: L.intangibles[2], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    { key: "leadership", label: L.intangibles[3], type: "slider", required: true, min: 1, max: 10, step: 1 },
                    {
                        key: "intangibles_projection",
                        label: "Projection",
                        type: "slider",
                        required: false,
                        min: 1,
                        max: 10,
                        step: 1,
                        description: "1–4 Developmental · 5–6 Solid · 7–8 High Upside · 9–10 Elite Upside"
                    }
                ]
            }
        ]
    };
    // Validate shape to ensure defaults stay in sync with shared schema.
    const parsed = EvaluationFormDefinitionSchema.safeParse(base);
    if (!parsed.success) {
        throw new Error("Default evaluation form definition is invalid");
    }
    return parsed.data;
}
function normalizeProjectionTraits(categories) {
    let changed = false;
    const next = categories.map((c) => {
        const traits = Array.isArray(c?.traits) ? c.traits : [];
        const nextTraits = traits.map((t) => {
            const key = String(t?.key ?? "");
            if (!key.toLowerCase().includes("projection"))
                return t;
            // Convert any projection trait to a non-required numeric score field.
            changed = changed || t.type !== "slider" || t.required !== false;
            return {
                ...t,
                type: "slider",
                required: false,
                min: 1,
                max: 10,
                step: 1,
                options: undefined,
                description: t.description ?? "1–4 Developmental · 5–6 Solid · 7–8 High Upside · 9–10 Elite Upside"
            };
        });
        return { ...c, traits: nextTraits };
    });
    return { next, changed };
}
// Evaluator/Admin: fetch the active form for a sport. If none exists, create a default.
evaluationFormsRouter.get("/evaluation-forms/active", requireAuth, requireRole([ROLE.EVALUATOR, ROLE.ADMIN]), async (req, res, next) => {
    try {
        const sport = normalizeSport(req.query.sport);
        if (!sport)
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "sport is required" }));
        const existing = await EvaluationFormModel.findOne({ sport, isActive: true }).sort({ updatedAt: -1 }).lean();
        if (existing) {
            const cats = Array.isArray(existing.categories) ? existing.categories : [];
            const norm = normalizeProjectionTraits(cats);
            // If this is an older system default form, upgrade it to the latest sport-specific rubric.
            const existingVersion = Number(existing.version ?? 1);
            const shouldUpgradeDefault = isSystemDefaultForm(existing) && existingVersion < DEFAULT_FORM_VERSION;
            if (shouldUpgradeDefault) {
                const def = defaultFormForSport(sport);
                const updated = await EvaluationFormModel.findByIdAndUpdate(existing._id, {
                    $set: {
                        title: def.title,
                        version: def.version,
                        strengthsPrompt: def.strengthsPrompt,
                        improvementsPrompt: def.improvementsPrompt,
                        notesHelp: def.notesHelp,
                        categories: def.categories
                    }
                }, { new: true }).lean();
                return res.json(updated ?? def);
            }
            if (norm.changed) {
                // Best-effort: persist projection normalization so all clients see the updated definition.
                const updated = await EvaluationFormModel.findByIdAndUpdate(existing._id, { $set: { categories: norm.next } }, { new: true }).lean();
                return res.json(updated ?? { ...existing, categories: norm.next });
            }
            return res.json(existing);
        }
        const def = defaultFormForSport(sport);
        const created = await EvaluationFormModel.create({
            title: def.title,
            sport: def.sport,
            version: def.version,
            isActive: true,
            strengthsPrompt: def.strengthsPrompt,
            improvementsPrompt: def.improvementsPrompt,
            notesHelp: def.notesHelp,
            categories: def.categories
        });
        return res.json(created);
    }
    catch (err) {
        return next(err);
    }
});
// Admin: list forms
evaluationFormsRouter.get("/admin/evaluation-forms", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    try {
        const sport = String(req.query.sport ?? "").trim().toLowerCase();
        const activeOnly = String(req.query.activeOnly ?? "").trim() === "1";
        const filter = {};
        if (sport)
            filter.sport = sport;
        if (activeOnly)
            filter.isActive = true;
        const results = await EvaluationFormModel.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
        return res.json({ results });
    }
    catch (err) {
        return next(err);
    }
});
// Admin: create form
evaluationFormsRouter.post("/admin/evaluation-forms", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    const parsed = EvaluationFormCreateSchema.safeParse(req.body);
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
    try {
        const created = await EvaluationFormModel.create({
            ...parsed.data,
            sport: String(parsed.data.sport).toLowerCase(),
            categories: parsed.data.categories,
            createdByUserId: new mongoose.Types.ObjectId(req.user.id)
        });
        if (created.isActive) {
            await EvaluationFormModel.updateMany({ _id: { $ne: created._id }, sport: created.sport, isActive: true }, { $set: { isActive: false } });
        }
        return res.status(201).json(created);
    }
    catch (err) {
        return next(err);
    }
});
// Admin: update form
evaluationFormsRouter.patch("/admin/evaluation-forms/:id", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid id" }));
    }
    const parsed = EvaluationFormUpdateSchema.safeParse(req.body);
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
    try {
        const updated = await EvaluationFormModel.findByIdAndUpdate(req.params.id, {
            ...parsed.data,
            ...(parsed.data.sport ? { sport: String(parsed.data.sport).toLowerCase() } : {}),
            ...(parsed.data.categories ? { categories: parsed.data.categories } : {})
        }, { new: true }).lean();
        if (!updated)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Form not found" }));
        if (updated.isActive) {
            await EvaluationFormModel.updateMany({ _id: { $ne: updated._id }, sport: updated.sport, isActive: true }, { $set: { isActive: false } });
        }
        return res.json(updated);
    }
    catch (err) {
        return next(err);
    }
});
// Admin: delete form
evaluationFormsRouter.delete("/admin/evaluation-forms/:id", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid id" }));
    }
    try {
        const deleted = await EvaluationFormModel.findByIdAndDelete(req.params.id).lean();
        if (!deleted)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Form not found" }));
        return res.status(204).send();
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=evaluationForms.js.map