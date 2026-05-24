/**
 * Phase state machine for a single round of Backstab Court.
 *
 * Default durations tuned for the blueprint 8–10 min match length.
 * Server can override via env; clients always read phaseEndsAt off the wire.
 */
export declare const Phase: {
    readonly LOBBY: "LOBBY";
    readonly CHARGE: "CHARGE";
    readonly ACCUSE: "ACCUSE";
    readonly DEFEND: "DEFEND";
    readonly JURY: "JURY";
    readonly VERDICT: "VERDICT";
    readonly MATCH_END: "MATCH_END";
};
export type Phase = (typeof Phase)[keyof typeof Phase];
export declare const PHASE_DURATION_SEC: Record<Phase, number>;
export declare const ROUNDS_PER_MATCH = 2;
export declare const MIN_PLAYERS = 2;
export declare const MAX_PLAYERS = 6;
export declare const BASE_XP_STAKE = 10;
//# sourceMappingURL=phases.d.ts.map