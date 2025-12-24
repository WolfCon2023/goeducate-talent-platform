export const ROLE = {
  PLAYER: "player",
  COACH: "coach",
  EVALUATOR: "evaluator",
  ADMIN: "admin"
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ALL_ROLES: readonly Role[] = [ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN] as const;


