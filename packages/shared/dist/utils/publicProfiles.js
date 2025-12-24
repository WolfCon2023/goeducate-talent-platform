function isAuthorizedForPrivate(profileUserId, requester) {
    if (!requester)
        return false;
    if (requester.id === profileUserId)
        return true;
    if (requester.role === "admin")
        return true;
    if (requester.role === "evaluator")
        return true; // read-only access for workflow
    return false;
}
export function buildPublicPlayerProfile(profile, requester) {
    const canSeePrivate = isAuthorizedForPrivate(profile.userId, requester);
    if (!profile.isProfilePublic && !canSeePrivate)
        return null;
    const isSubscribedCoach = requester?.role === "coach" && requester.subscriptionStatus === "active";
    const canSeeContact = canSeePrivate || (isSubscribedCoach && profile.isContactVisibleToSubscribedCoaches === true);
    const { contactEmail, contactPhone, ...rest } = profile;
    return {
        ...rest,
        ...(canSeeContact ? { contactEmail, contactPhone } : {})
    };
}
export function buildPublicCoachProfile(profile, requester) {
    const canSeePrivate = isAuthorizedForPrivate(profile.userId, requester);
    if (!profile.isProfilePublic && !canSeePrivate)
        return null;
    return profile;
}
export function buildPublicEvaluatorProfile(profile, requester) {
    const canSeePrivate = isAuthorizedForPrivate(profile.userId, requester);
    if (!profile.isProfilePublic && !canSeePrivate)
        return null;
    return profile;
}
//# sourceMappingURL=publicProfiles.js.map