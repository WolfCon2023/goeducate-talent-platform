import type { Role } from "../types/roles.js";
import type { CoachProfile } from "../schemas/coachProfile.js";
import type { EvaluatorProfile } from "../schemas/evaluatorProfile.js";
import type { PlayerProfile } from "../schemas/playerProfile.js";

export type PublicProfileRequester = {
  id: string;
  role: Role;
  subscriptionStatus?: string | null;
} | null;

function isAuthorizedForPrivate(profileUserId: string, requester: PublicProfileRequester) {
  if (!requester) return false;
  if (requester.id === profileUserId) return true;
  if (requester.role === "admin") return true;
  if (requester.role === "evaluator") return true; // read-only access for workflow
  return false;
}

export function buildPublicPlayerProfile(profile: PlayerProfile, requester: PublicProfileRequester) {
  const canSeePrivate = isAuthorizedForPrivate(profile.userId, requester);
  if (!profile.isProfilePublic && !canSeePrivate) return null;

  const isSubscribedCoach = requester?.role === "coach" && requester.subscriptionStatus === "active";
  const canSeeContact =
    canSeePrivate || (isSubscribedCoach && profile.isContactVisibleToSubscribedCoaches === true);

  const { contactEmail, contactPhone, ...rest } = profile as any;
  return {
    ...rest,
    ...(canSeeContact ? { contactEmail, contactPhone } : {})
  } as PlayerProfile;
}

export function buildPublicCoachProfile(profile: CoachProfile, requester: PublicProfileRequester) {
  const canSeePrivate = isAuthorizedForPrivate(profile.userId, requester);
  if (!profile.isProfilePublic && !canSeePrivate) return null;
  return profile;
}

export function buildPublicEvaluatorProfile(profile: EvaluatorProfile, requester: PublicProfileRequester) {
  const canSeePrivate = isAuthorizedForPrivate(profile.userId, requester);
  if (!profile.isProfilePublic && !canSeePrivate) return null;
  return profile;
}


