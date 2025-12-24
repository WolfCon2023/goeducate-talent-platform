import type { CoachProfile } from "../schemas/coachProfile.js";
import type { EvaluatorProfile } from "../schemas/evaluatorProfile.js";
import type { PlayerProfile } from "../schemas/playerProfile.js";
type CompletionResult = {
    score: number;
    missing: string[];
};
export declare function computePlayerProfileCompletion(profile: Partial<PlayerProfile> | null | undefined): CompletionResult;
export declare function computeCoachProfileCompletion(profile: Partial<CoachProfile> | null | undefined): CompletionResult;
export declare function computeEvaluatorProfileCompletion(profile: Partial<EvaluatorProfile> | null | undefined): CompletionResult;
export {};
//# sourceMappingURL=profileCompletion.d.ts.map