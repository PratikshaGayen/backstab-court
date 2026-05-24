import type { Player } from "@backstab/shared";

export default function Leaderboard({
  players,
  selfId,
  title,
}: {
  players: Player[];
  selfId: string | null;
  title?: string;
}) {
  const sorted = [...players].sort((a, b) => b.xp - a.xp);
  const hasXp = sorted.some((p) => p.xp !== 0);

  return (
    <div className="panel leaderboard-panel">
      <h4 style={{ marginTop: 0, marginBottom: 12 }}>{title ?? "Leaderboard"}</h4>
      {sorted.length === 0 ? (
        <p className="muted small">No players yet</p>
      ) : (
        <div className="lb-list">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`lb-item ${p.id === selfId ? "lb-self" : ""} ${!p.connected ? "lb-disconnected" : ""}`}
            >
              <span className="lb-name">
                {hasXp && i === 0 && sorted.length > 1 && <span className="lb-crown">👑</span>}
                {p.displayName}
                {p.id === selfId && <span className="lb-you">(you)</span>}
              </span>
              {hasXp && (
                <span className={`lb-xp ${p.xp > 0 ? "positive" : p.xp < 0 ? "negative" : ""}`}>
                  {p.xp > 0 ? "+" : ""}{p.xp}
                </span>
              )}
              {!hasXp && (
                <span className="lb-status">
                  {p.connected ? "Ready" : "Away"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
