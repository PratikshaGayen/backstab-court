import type { Player, Verdict } from "@backstab/shared";

export default function VerdictBanner({
  verdict,
  players,
}: {
  verdict: Verdict;
  players: Player[];
}) {
  const defendant = players.find((p) => p.id === verdict.defendant);
  const color =
    verdict.outcome === "GUILTY" ? "#e53935" : verdict.outcome === "INNOCENT" ? "#4caf50" : "#f5c542";

  return (
    <div className="panel" style={{ borderLeft: `6px solid ${color}` }}>
      <div className="small muted">Verdict</div>
      <h2 style={{ color, margin: "6px 0" }}>
        {verdict.outcome}
        {verdict.appealed && <span className="small" style={{ marginLeft: 12, color: "#f5c542" }}>⚡ APPEALED</span>}
      </h2>
      <p style={{ margin: 0 }}>
        <strong>{defendant?.displayName ?? "Defendant"}</strong> is {verdict.outcome.toLowerCase()}.
      </p>
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {Object.entries(verdict.xpDelta).map(([pid, delta]) => {
          const p = players.find((pl) => pl.id === pid);
          if (!p) return null;
          const pos = delta > 0;
          return (
            <span
              key={pid}
              className="pill"
              style={{ background: pos ? "#1b3a1e" : "#3a1b1b", color: pos ? "#9cffa0" : "#ff9c9c" }}
            >
              {p.displayName} {pos ? "+" : ""}{delta} XP
            </span>
          );
        })}
      </div>
    </div>
  );
}
