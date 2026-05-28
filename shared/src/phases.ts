/**
 * Phase state machine for a single round of Backstab Court.
 *
 * Default durations tuned for the blueprint 8–10 min match length.
 * Server can override via env; clients always read phaseEndsAt off the wire.
 */
export const Phase = {
  LOBBY: "LOBBY",
  CHARGE: "CHARGE",
  ACCUSE: "ACCUSE",
  DEFEND: "DEFEND",
  JURY: "JURY",
  VERDICT: "VERDICT",
  MATCH_END: "MATCH_END",
} as const;

export type Phase = (typeof Phase)[keyof typeof Phase];

export const PHASE_DURATION_SEC: Record<Phase, number> = {
  LOBBY: 0,
  CHARGE: 8,
  ACCUSE: 25,
  DEFEND: 20,
  JURY: 360, // studionet contract call takes 2–5 min; server manages this dynamically
  VERDICT: 8,
  MATCH_END: 0,
};

export const ROUNDS_PER_MATCH = 2;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export const BASE_XP_STAKE = 10;
