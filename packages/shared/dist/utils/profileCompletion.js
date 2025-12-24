function clamp01(n) {
    return Math.max(0, Math.min(1, n));
}
function scoreFrom(parts) {
    const total = parts.reduce((sum, p) => sum + p.weight, 0);
    const earned = parts.reduce((sum, p) => sum + (p.present ? p.weight : 0), 0);
    const missing = parts.filter((p) => !p.present).map((p) => p.missingKey);
    const raw = total > 0 ? earned / total : 0;
    return { score: Math.round(clamp01(raw) * 100), missing };
}
function hasText(v) {
    return typeof v === "string" && v.trim().length > 0;
}
function hasNumber(v) {
    return typeof v === "number" && Number.isFinite(v);
}
function hasArray(v) {
    return Array.isArray(v) && v.length > 0;
}
export function computePlayerProfileCompletion(profile) {
    const p = profile ?? {};
    const height = hasNumber(p.heightInInches) ? p.heightInInches : p.heightIn;
    const weight = hasNumber(p.weightLbs) ? p.weightLbs : p.weightLb;
    const parts = [
        // Identity (10)
        { weight: 5, present: hasText(p.firstName), missingKey: "firstName" },
        { weight: 5, present: hasText(p.lastName), missingKey: "lastName" },
        // Basics (30)
        { weight: 10, present: hasText(p.position), missingKey: "position" },
        { weight: 10, present: hasNumber(p.gradYear), missingKey: "gradYear" },
        { weight: 10, present: hasText(p.school), missingKey: "school" },
        // Location (10)
        { weight: 5, present: hasText(p.city), missingKey: "city" },
        { weight: 5, present: hasText(p.state), missingKey: "state" },
        // Athletics (15)
        { weight: 8, present: hasNumber(height), missingKey: "heightInInches" },
        { weight: 7, present: hasNumber(weight), missingKey: "weightLbs" },
        // Metrics (10): fortyTime OR verticalInches
        { weight: 10, present: hasNumber(p.fortyTime) || hasNumber(p.verticalInches), missingKey: "fortyTimeOrVerticalInches" },
        // Academics (10)
        { weight: 10, present: hasNumber(p.gpa), missingKey: "gpa" },
        // Media (10)
        { weight: 10, present: hasText(p.highlightPhotoUrl), missingKey: "highlightPhotoUrl" },
        // Jersey (5)
        { weight: 5, present: hasNumber(p.jerseyNumber), missingKey: "jerseyNumber" }
    ];
    return scoreFrom(parts);
}
export function computeCoachProfileCompletion(profile) {
    const p = profile ?? {};
    const hasRecruitingPrefs = hasArray(p.positionsOfInterest) || hasArray(p.gradYears) || hasArray(p.regions);
    const parts = [
        // Identity (15)
        { weight: 8, present: hasText(p.firstName), missingKey: "firstName" },
        { weight: 7, present: hasText(p.lastName), missingKey: "lastName" },
        // Institution (35)
        { weight: 35, present: hasText(p.institutionName), missingKey: "institutionName" },
        // Program (10)
        { weight: 10, present: hasText(p.programLevel), missingKey: "programLevel" },
        // Location (10)
        { weight: 10, present: hasText(p.institutionLocation), missingKey: "institutionLocation" },
        // Recruiting prefs (20): any one of positionsOfInterest, gradYears, regions
        { weight: 20, present: hasRecruitingPrefs, missingKey: "recruitingPreferences" },
        // Title (10)
        { weight: 10, present: hasText(p.title), missingKey: "title" }
    ];
    return scoreFrom(parts);
}
export function computeEvaluatorProfileCompletion(profile) {
    const p = profile ?? {};
    const parts = [
        // Identity (20)
        { weight: 10, present: hasText(p.firstName), missingKey: "firstName" },
        { weight: 10, present: hasText(p.lastName), missingKey: "lastName" },
        // Title (10)
        { weight: 10, present: hasText(p.title), missingKey: "title" },
        // Bio (20)
        { weight: 20, present: hasText(p.bio), missingKey: "bio" },
        // ExperienceYears (20)
        { weight: 20, present: hasNumber(p.experienceYears), missingKey: "experienceYears" },
        // Credentials (15)
        { weight: 15, present: hasArray(p.credentials), missingKey: "credentials" },
        // Specialties (15)
        { weight: 15, present: hasArray(p.specialties), missingKey: "specialties" }
    ];
    return scoreFrom(parts);
}
//# sourceMappingURL=profileCompletion.js.map