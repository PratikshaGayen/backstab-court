import type { Charge, Player } from "@backstab/shared";
import { ROUNDS_PER_MATCH } from "@backstab/shared";

export default function ChargeCard({
  charge,
  defendant,
  round,
}: {
  charge: Charge;
  defendant: Player;
  round: number;
}) {
  const isFinal = round === ROUNDS_PER_MATCH;
  return (
    <div className={`panel charge ${isFinal ? "charge-final" : ""}`}>
      <div className="small muted">
        Round {round}
        {isFinal && (
          <span className="final-badge">FINAL ROUND - DOUBLE XP</span>
        )}
      </div>
      <div className="charge-label">HOT TAKE</div>
      <h2 className="charge-text">"{charge.text}"</h2>
      <div className="charge-defendant">
        <span className="charge-role">Defender:</span> {defendant.displayName}
      </div>
      <p className="charge-instruction muted small">
        Prosecutors: argue why this take is WRONG. Defendant: argue why it's RIGHT.
      </p>
    </div>
  );
}
