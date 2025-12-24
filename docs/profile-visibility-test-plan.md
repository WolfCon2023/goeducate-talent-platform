# Profile visibility test plan (MVP)

This document provides curl examples to validate profile visibility controls and access rules.

## Prerequisites

- Set `API_BASE` to your API URL.
- Obtain JWT access tokens for a player, coach, evaluator, and admin.

```bash
export API_BASE="https://api-talent.goeducateinc.org"
export PLAYER_TOKEN="..."
export COACH_TOKEN="..."
export EVALUATOR_TOKEN="..."
export ADMIN_TOKEN="..."
export SOME_PLAYER_USER_ID="..."
export SOME_COACH_USER_ID="..."
export SOME_EVALUATOR_USER_ID="..."
```

## 1) Self profile: GET /profiles/me

Player:

```bash
curl -sS "$API_BASE/profiles/me" \
  -H "Authorization: Bearer $PLAYER_TOKEN" | jq
```

Coach:

```bash
curl -sS "$API_BASE/profiles/me" \
  -H "Authorization: Bearer $COACH_TOKEN" | jq
```

Evaluator:

```bash
curl -sS "$API_BASE/profiles/me" \
  -H "Authorization: Bearer $EVALUATOR_TOKEN" | jq
```

Expected:
- 200 with `{ profile, profileCompletion: { score, missing } }`
- 404 if the role has no profile document yet.

## 2) Self profile: PUT /profiles/me (visibility toggle + audit logging)

### Player: set profile private

```bash
curl -sS -X PUT "$API_BASE/profiles/me" \
  -H "Authorization: Bearer $PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isProfilePublic": false}' | jq
```

### Player: allow contact visibility to subscribed coaches

```bash
curl -sS -X PUT "$API_BASE/profiles/me" \
  -H "Authorization: Bearer $PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isContactVisibleToSubscribedCoaches": true}' | jq
```

Expected:
- 200 with updated profile + profileCompletion
- Audit log records created for `PROFILE_UPDATED`
- If `isProfilePublic` changed, also `PROFILE_VISIBILITY_CHANGED`

## 3) Public profile endpoints (must return 404 for unauthorized access to private profiles)

### Player public profile

```bash
curl -i "$API_BASE/profiles/player/$SOME_PLAYER_USER_ID"
```

Expected:
- 200 if profile is public
- 404 if profile is private (avoid existence leakage)

### Coach tries to view a private player profile (should be 404)

```bash
curl -i "$API_BASE/profiles/player/$SOME_PLAYER_USER_ID" \
  -H "Authorization: Bearer $COACH_TOKEN"
```

Expected:
- 404 if the player profile is private

### Owner can view their own private profile via public endpoint (allowed)

```bash
curl -i "$API_BASE/profiles/player/$SOME_PLAYER_USER_ID" \
  -H "Authorization: Bearer $PLAYER_TOKEN"
```

Expected:
- 200 if `$SOME_PLAYER_USER_ID` matches the player token subject.

## 4) Contact gating rules (player profiles only)

Contact fields should be removed unless:
- requester is the profile owner, OR
- requester is an admin, OR
- requester is a coach with subscriptionStatus "active" AND the player set `isContactVisibleToSubscribedCoaches=true`.

```bash
curl -sS "$API_BASE/profiles/player/$SOME_PLAYER_USER_ID" \
  -H "Authorization: Bearer $COACH_TOKEN" | jq
```

Expected:
- `contactEmail/contactPhone` present only when the above conditions are met.

## 5) Search (MVP): GET /search/players

Search should only return public player profiles.

```bash
curl -sS "$API_BASE/search/players?q=smith&state=TX&limit=10" \
  -H "Authorization: Bearer $COACH_TOKEN" | jq
```

Expected:
- Results only include profiles with `isProfilePublic=true`.

## 6) Admin audit logs endpoint

```bash
curl -sS "$API_BASE/admin/audit-logs?action=PROFILE_VISIBILITY_CHANGED&limit=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

Expected:
- 200 and recent audit log items.


