import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGenLayer } from "../hooks/useGenLayer";

interface LeaderboardEntry {
  address: string;
  xp: number;
  wins: number;
  losses: number;
}

export default function GlobalLeaderboard() {
  const { readContract, address } = useGenLayer();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [readContract]);

  async function loadLeaderboard() {
    setLoading(true);
    setError(null);
    try {
      // For now, we can only query stats for known addresses.
      // In a full implementation, the contract would track all participants.
      // Here we show the current player's stats as a starting point.
      if (!address) {
        setError("Connect your wallet to view stats");
        setLoading(false);
        return;
      }

      const stats = (await readContract("get_player_stats", [address])) as {
        xp: number;
        wins: number;
        losses: number;
      };

      setEntries([
        {
          address: address,
          xp: Number(stats.xp),
          wins: Number(stats.wins),
          losses: Number(stats.losses),
        },
      ]);
    } catch (e: any) {
      // Contract not configured or not reachable
      setError(
        "Leaderboard requires a deployed contract. Play matches to accumulate on-chain XP.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="header-row">
        <h2>🏆 Global Leaderboard</h2>
        <Link to="/lobby">
          <button className="ghost">Back to lobby</button>
        </Link>
      </div>

      <div className="panel">
        <p className="small muted" style={{ marginBottom: 16 }}>
          On-chain XP from all matches played via the GenLayer contract.
          Updated after each verdict reaches consensus.
        </p>

        {loading && <p className="muted">Loading...</p>}
        {error && <p className="muted">{error}</p>}

        {!loading && !error && entries.length > 0 && (
          <table className="lb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Address</th>
                <th>XP</th>
                <th>W</th>
                <th>L</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const total = e.wins + e.losses;
                const rate = total > 0 ? Math.round((e.wins / total) * 100) : 0;
                const isMe = e.address === address;
                return (
                  <tr key={e.address} style={{ fontWeight: isMe ? 700 : 400 }}>
                    <td>{i + 1}</td>
                    <td className="mono">
                      {e.address.slice(0, 6)}...{e.address.slice(-4)}
                      {isMe && <span className="small muted"> (you)</span>}
                    </td>
                    <td style={{ color: "var(--gold)" }}>{e.xp}</td>
                    <td style={{ color: "var(--ok)" }}>{e.wins}</td>
                    <td style={{ color: "var(--accent)" }}>{e.losses}</td>
                    <td>{rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && !error && entries.length === 0 && (
          <p className="muted">No matches played yet. Go play!</p>
        )}
      </div>
    </div>
  );
}
