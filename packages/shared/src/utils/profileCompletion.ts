import type { CoachProfile } from "../schemas/coachProfile.js";
import type { EvaluatorProfile } from "../schemas/evaluatorProfile.js";
import type { PlayerProfile } from "../schemas/playerProfile.js";

type CompletionResult = { score: number; missing: string[] };

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function scoreFrom(parts: Array<{ weight: number; present: boolean; missingKey: string }>): CompletionResult {
  const total = parts.reduce((sum, p) => sum + p.weight, 0);
  const earned = parts.reduce((sum, p) => sum + (p.present ? p.weight : 0), 0);
  const missing = parts.filter((p) => !p.present).map((p) => p.missingKey);
  const raw = total > 0 ? earned / total : 0;
  return { score: Math.round(clamp01(raw) * 100), missing };
}

function hasText(v: unknown) {
  return typeof v === "string" && v.trim().length > 0;
}

function hasNumber(v: unknown) {
  return typeof v === "number" && Number.isFinite(v);
}

function hasArray(v: unknown) {
  return Array.isArray(v) && v.length > 0;
}

export function computePlayerProfileCompletion(profile: Partial<PlayerProfile> | null | undefined): CompletionResult {
  const p = profile ?? {};
  const height = hasNumber((p as any).heightInInches) ? (p as any).heightInInches : (p as any).heightIn;
  const weight = hasNumber((p as any).weightLbs) ? (p as any).weightLbs : (p as any).weightLb;

  const parts: Array<{ weight: number; present: boolean; missingKey: string }> = [
    // Identity (10)
    { weight: 5, present: hasText(p.firstName), missingKey: "firstName" },
    { weight: 5, present: hasText(p.lastName), missingKey: "lastName" },
    // Basics (30)
    { weight: 10, present: hasText(p.position), missingKey: "position" },
    { weight: 10, present: hasNumber(p.gradYear), missingKey: "gradYear" },
    { weight: 10, present: hasText((p as any).school), missingKey: "school" },
    // Location (10)
    { weight: 5, present: hasText(p.city), missingKey: "city" },
    { weight: 5, present: hasText(p.state), missingKey: "state" },
    // Athletics (15)
    { weight: 8, present: hasNumber(height), missingKey: "heightInInches" },
    { weight: 7, present: hasNumber(weight), missingKey: "weightLbs" },
    // Metrics (10): fortyTime OR verticalInches
    { weight: 10, present: hasNumber((p as any).fortyTime) || hasNumber((p as any).verticalInches), missingKey: "fortyTimeOrVerticalInches" },
    // Academics (10)
    { weight: 10, present: hasNumber((p as any).gpa), missingKey: "gpa" },
    // Media (10)
    { weight: 10, present: hasText((p as any).highlightPhotoUrl), missingKey: "highlightPhotoUrl" },
    // Jersey (5)
    { weight: 5, present: hasNumber((p as any).jerseyNumber), missingKey: "jerseyNumber" }
  ];

  return scoreFrom(parts);
}

export function computeCoachProfileCompletion(profile: Partial<CoachProfile> | null | undefined): CompletionResult {
  const p = profile ?? {};
  const hasRecruitingPrefs = hasArray((p as any).positionsOfInterest) || hasArray((p as any).gradYears) || hasArray((p as any).regions);

  const parts: Array<{ weight: number; present: boolean; missingKey: string }> = [
    // Identity (15)
    { weight: 8, present: hasText(p.firstName), missingKey: "firstName" },
    { weight: 7, present: hasText(p.lastName), missingKey: "lastName" },
    // Institution (35)
    { weight: 35, present: hasText((p as any).institutionName), missingKey: "institutionName" },
    // Program (10)
    { weight: 10, present: hasText((p as any).programLevel), missingKey: "programLevel" },
    // Location (10)
    { weight: 10, present: hasText((p as any).institutionLocation), missingKey: "institutionLocation" },
    // Recruiting prefs (20): any one of positionsOfInterest, gradYears, regions
    { weight: 20, present: hasRecruitingPrefs, missingKey: "recruitingPreferences" },
    // Title (10)
    { weight: 10, present: hasText((p as any).title), missingKey: "title" }
  ];

  return scoreFrom(parts);
}

export function computeEvaluatorProfileCompletion(profile: Partial<EvaluatorProfile> | null | undefined): CompletionResult {
  const p = profile ?? {};

  const parts: Array<{ weight: number; present: boolean; missingKey: string }> = [
    // Identity (20)
    { weight: 10, present: hasText(p.firstName), missingKey: "firstName" },
    { weight: 10, present: hasText(p.lastName), missingKey: "lastName" },
    // Title (10)
    { weight: 10, present: hasText((p as any).title), missingKey: "title" },
    // Bio (20)
    { weight: 20, present: hasText((p as any).bio), missingKey: "bio" },
    // ExperienceYears (20)
    { weight: 20, present: hasNumber((p as any).experienceYears), missingKey: "experienceYears" },
    // Credentials (15)
    { weight: 15, present: hasArray((p as any).credentials), missingKey: "credentials" },
    // Specialties (15)
    { weight: 15, present: hasArray((p as any).specialties), missingKey: "specialties" }
  ];

  return scoreFrom(parts);
}


