import type { PlayerId, Verdict } from "./types";
/**
 * Match-end titles computed from the round history.
 * Each title goes to exactly one player (the "most" of something).
 */
export interface MatchTitle {
    title: string;
    emoji: string;
    description: string;
    playerId: PlayerId;
}
export declare function computeTitles(history: Array<{
    round: number;
    verdict: Verdict;
}>, playerIds: PlayerId[]): MatchTitle[];
//# sourceMappingURL=titles.d.ts.map