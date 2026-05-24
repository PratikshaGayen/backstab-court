import { Phase, PHASE_DURATION_SEC, ROUNDS_PER_MATCH } from "@backstab/shared";

/**
 * Pure state transitions. Timers are owned by Room.
 *
 * Flow inside a round:
 *   CHARGE → ACCUSE → DEFEND → JURY → VERDICT
 * After VERDICT: either start next round's CHARGE, or end the match.
 */
export class PhaseMachine {
  public round: number;
  public phase: Phase;

  constructor(startPhase: Phase = Phase.LOBBY, round = 0) {
    this.phase = startPhase;
    this.round = round;
  }

  startMatch(): void {
    this.round = 1;
    this.phase = Phase.CHARGE;
  }

  advance(): Phase {
    switch (this.phase) {
      case Phase.CHARGE:
        this.phase = Phase.ACCUSE;
        break;
      case Phase.ACCUSE:
        this.phase = Phase.DEFEND;
        break;
      case Phase.DEFEND:
        this.phase = Phase.JURY;
        break;
      case Phase.JURY:
        this.phase = Phase.VERDICT;
        break;
      case Phase.VERDICT:
        if (this.round >= ROUNDS_PER_MATCH) {
          this.phase = Phase.MATCH_END;
        } else {
          this.round += 1;
          this.phase = Phase.CHARGE;
        }
        break;
      case Phase.LOBBY:
      case Phase.MATCH_END:
        // No auto-advance from terminal phases.
        break;
    }
    return this.phase;
  }

  phaseDurationMs(): number {
    return PHASE_DURATION_SEC[this.phase] * 1000;
  }
}
