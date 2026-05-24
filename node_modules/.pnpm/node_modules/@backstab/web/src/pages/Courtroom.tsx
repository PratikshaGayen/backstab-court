import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CEvent, Phase, ROUNDS_PER_MATCH } from "@backstab/shared";
import { useSocket } from "../hooks/useSocket";
import { useRoomState } from "../hooks/useRoomState";
import { useWalletRegistration } from "../hooks/useWalletRegistration";
import { useGenLayer } from "../hooks/useGenLayer";   // FIXED: #12
import ChargeCard from "../components/ChargeCard";
import AccusationInput from "../components/AccusationInput";
import DefenseInput from "../components/DefenseInput";
import JuryStream from "../components/JuryStream";
import VerdictBanner from "../components/VerdictBanner";
import VerdictCard from "../components/VerdictCard";
import Leaderboard from "../components/Leaderboard";
import PhaseTimer from "../components/PhaseTimer";
import { storage } from "../lib/storage";   // FIXED: #17

export default function Courtroom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const { room, juryBubbles, lastVerdict, matchEnd } = useRoomState(socket);
  useWalletRegistration(socket, roomId);
  const { address: walletAddress } = useGenLayer();   // FIXED: #12

  const [accusationSent, setAccusationSent] = useState(false);
  const [defenseSent, setDefenseSent] = useState(false);
  const [joinAttempted, setJoinAttempted] = useState(false);
  const [matchStarting, setMatchStarting] = useState(false);

  const selfId = socket.id ?? null;
  const isSpectator = new URLSearchParams(window.location.search).has("spectator");

  // Auto-rejoin: if we land on this page with a connected socket but no room state,
  // re-emit the join (the server will just send us the current snapshot).
  useEffect(() => {
    if (!connected || !roomId || room || joinAttempted) return;
    setJoinAttempted(true);

    const displayName = storage.get("bc_display_name") ?? "Player";   // FIXED: #17

    if (isSpectator) {
      socket.emit("c:spectate_room", { roomId }, (resp: any) => {
        if (!resp?.ok) {
          console.warn("[courtroom] spectate failed:", resp?.error);
        }
      });
    } else {
      socket.emit("c:join_room", {
        roomId,
        displayName,
        clientId: walletAddress ?? undefined,   // FIXED: #12
      }, (resp: any) => {
        if (!resp?.ok && resp?.error !== "match_in_progress") {
          console.warn("[courtroom] rejoin failed:", resp?.error);
        }
      });
    }
  }, [connected, roomId, room, joinAttempted, isSpectator, socket, walletAddress]);

  // FIXED: #12 — re-emit join on every reconnect so we reclaim our slot
  useEffect(() => {
    if (!socket || !roomId || isSpectator) return;
    const onConnect = () => {
      socket.emit("c:join_room", {
        roomId,
        displayName: storage.get("bc_display_name") ?? "Player",
        clientId: walletAddress ?? undefined,
      });
    };
    socket.on("connect", onConnect);
    return () => { socket.off("connect", onConnect); };
  }, [socket, roomId, isSpectator, walletAddress]);

  // Reset per-round local flags when phase resets
  useEffect(() => {
  if (room?.phase === Phase.CHARGE) {
    setAccusationSent(false);
    setDefenseSent(false);
    setMatchStarting(false);
  }
}, [room?.phase, room?.currentRound]);

  const defendant = useMemo(() => {
    if (!room?.roundState) return null;
    return room.players.find((p) => p.id === room.roundState!.defendant) ?? null;
  }, [room]);

  const isDefendant = !!defendant && defendant.id === selfId;
  const isHost = !!room && room.hostId === selfId;

  const startMatch = () => {
  setMatchStarting(true);
  socket.emit(CEvent.START_MATCH, {});
};
  const submitAccusation = (text: string) => {
    if (!roomId) return;
    socket.emit(CEvent.SUBMIT_ACCUSATION, { roomId, text });
    setAccusationSent(true);
  };
  const submitDefense = (text: string) => {
    if (!roomId) return;
    socket.emit(CEvent.SUBMIT_DEFENSE, { roomId, text });
    setDefenseSent(true);
  };

  const leaveRoom = () => {
    socket.emit(CEvent.LEAVE_ROOM);
    navigate("/lobby");
  };

  if (!connected) {
    return (
      <div className="container loading-screen">
        <div className="loading-content">
          <div className="loading-spinner" />
          <p>Connecting to server...</p>
        </div>
      </div>
    );
  }
  if (!room) {
    return (
      <div className="container loading-screen">
        <div className="loading-content">
          <div className="loading-spinner" />
          <p>Joining room <span className="room-code">{roomId}</span></p>
          <button onClick={() => navigate("/lobby")} className="btn-ghost" style={{ marginTop: 16 }}>
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header-row">
        <h2>Courtroom <span className="room-code">{room.id}</span></h2>
        <div className="header-right">
          {isSpectator && <span className="pill" style={{ background: "#2a2a35", color: "var(--muted)" }}>👁️ Spectator</span>}
          <span className="small muted">{phaseLabel(room.phase)} · Round {room.currentRound}/{ROUNDS_PER_MATCH}</span>
          <PhaseTimer endsAt={room.phaseEndsAt} />
          <button onClick={leaveRoom} className="ghost">Leave</button>
        </div>
      </div>

      <div className="two-col">
        <div className="main">
          {room.phase === Phase.LOBBY && !matchStarting && (
  <LobbyPanel
    playerCount={room.players.length}
    isHost={isHost}
    onStart={startMatch}
    onAddBots={() => {
      socket.emit("c:add_bots", { count: 4 }, () => {});
    }}
  />
)}

{room.phase === Phase.LOBBY && matchStarting && (
  <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
    <div className="loading-spinner" style={{ margin: "0 auto 20px" }} />
    <h3 style={{ marginBottom: 8 }}>Summoning the court...</h3>
    <p className="muted small">The AI jury is being assembled on-chain. This takes about 30–60 seconds.</p>
  </div>
)}

          {room.roundState && room.phase !== Phase.LOBBY && room.phase !== Phase.MATCH_END && defendant && (
            <>
              <ChargeCard
                charge={room.roundState.charge}
                defendant={defendant}
                round={room.roundState.round}
              />

              {room.phase === Phase.CHARGE && (
                <div className="panel"><p className="muted">Reading the charges aloud…</p></div>
              )}

              {room.phase === Phase.ACCUSE && !isDefendant && !isSpectator && (
                <AccusationInput onSubmit={submitAccusation} submitted={accusationSent} />
              )}
              {room.phase === Phase.ACCUSE && !isDefendant && isSpectator && (
                <div className="panel">
                  <p className="muted small">👁️ Spectating - prosecutors are writing accusations...</p>
                </div>
              )}
              {room.phase === Phase.ACCUSE && isDefendant && (
                <div className="panel">
                  <p className="muted">🪑 You're in the chair. Prosecutors are writing accusations…</p>
                </div>
              )}

              {room.phase === Phase.DEFEND && isDefendant && !isSpectator && (
                <DefenseInput onSubmit={submitDefense} submitted={defenseSent} />
              )}
              {room.phase === Phase.DEFEND && isDefendant && isSpectator && (
                <div className="panel">
                  <p className="muted small">👁️ Spectating - defendant is writing their defense...</p>
                </div>
              )}
              {room.phase === Phase.DEFEND && !isDefendant && (
                <AccusationsFeed accusations={room.roundState.accusations} players={room.players} />
              )}

              {(room.phase === Phase.JURY || room.phase === Phase.VERDICT) && (
                <>
                  <AccusationsFeed accusations={room.roundState.accusations} players={room.players} />
                  {room.roundState.defense && (
                    <div className="panel">
                      <h4 style={{ marginTop: 0 }}>Defense</h4>
                      <p>{room.roundState.defense.text}</p>
                    </div>
                  )}
                  <JuryStream bubbles={juryBubbles} />
                  {lastVerdict && <VerdictBanner verdict={lastVerdict} players={room.players} />}
                  {lastVerdict && room.roundState && (
                    <VerdictCard
                      verdict={lastVerdict}
                      players={room.players}
                      round={room.roundState.round}
                      charge={room.roundState.charge.text}
                    />
                  )}
                </>
              )}
            </>
          )}

          {room.phase === Phase.MATCH_END && matchEnd && (
            <MatchEndPanel
              leaderboard={matchEnd.leaderboard}
              titles={matchEnd.titles ?? []}
              selfId={selfId}
              onPlayAgain={() => {
                // Room resets to lobby automatically; just stay on the page
              }}
            />
          )}
        </div>

        <aside className="side">
          <Leaderboard
            players={room.players}
            selfId={selfId}
            title={room.phase === Phase.LOBBY ? "Players" : "Leaderboard"}
          />
          {room.roundState && (
            <div className="panel">
              <h4 style={{ marginTop: 0 }}>On trial</h4>
              <p style={{ margin: 0 }}>{defendant?.displayName ?? "?"}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function LobbyPanel({
  playerCount,
  isHost,
  onStart,
  onAddBots,
}: {
  playerCount: number;
  isHost: boolean;
  onStart: () => void;
  onAddBots: () => void;
}) {
  const ready = playerCount >= 2;
  const roomCode = window.location.pathname.split("/").pop() ?? "";
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="lobby-waiting">
      <div className="panel lobby-code-panel">
        <p className="muted small" style={{ marginBottom: 8 }}>Share this code with friends</p>
        <div className="room-code-display">
          <span className="room-code-big">{roomCode}</span>
          <button onClick={copyCode} className="btn-ghost btn-copy">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="panel lobby-status-panel">
        <div className="lobby-player-count">
          <div className="player-dots">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`player-dot ${i < playerCount ? "filled" : ""}`}
              />
            ))}
          </div>
          <p style={{ margin: "12px 0 0" }}>
            <strong>{playerCount}</strong> / 2-6 players
          </p>
        </div>

        {!ready && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <p className="muted">
              Need {2 - playerCount} more player{2 - playerCount !== 1 ? "s" : ""}
            </p>
            {isHost && (
              <button onClick={onAddBots} className="btn-ghost">
                🤖 Fill with bots
              </button>
            )}
          </div>
        )}

        {ready && isHost && (
          <button onClick={onStart} className="btn-primary btn-lg" style={{ marginTop: 16, width: "100%" }}>
            Start match
          </button>
        )}

        {ready && !isHost && (
          <p className="muted" style={{ marginTop: 12 }}>
            Ready! Waiting for host to start...
          </p>
        )}
      </div>

      <div className="panel lobby-rules-mini">
        <h4>While you wait...</h4>
        <p className="muted small">
          Each round, one player is put on trial for an absurd crime.
          Everyone else writes an accusation. The defendant writes a defense.
          Then 5 AI personas vote on the verdict. Highest XP after 4 rounds wins.
        </p>
      </div>
    </div>
  );
}

function AccusationsFeed({
  accusations,
  players,
}: {
  accusations: { accuser: string; text: string }[];
  players: { id: string; displayName: string }[];
}) {
  if (accusations.length === 0) {
    return (
      <div className="panel">
        <p className="muted small">Awaiting accusations…</p>
      </div>
    );
  }
  return (
    <div className="panel">
      <h4 style={{ marginTop: 0 }}>Accusations</h4>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        {accusations.map((a, i) => {
          const p = players.find((pl) => pl.id === a.accuser);
          return (
            <li key={i} style={{ marginBottom: 8 }}>
              <strong>{p?.displayName ?? "?"}:</strong> {a.text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MatchEndPanel({
  leaderboard,
  titles,
  selfId,
  onPlayAgain,
}: {
  leaderboard: { id: string; displayName: string; xp: number }[];
  titles: Array<{ title: string; emoji: string; description: string; playerId: string }>;
  selfId: string | null;
  onPlayAgain: () => void;
}) {
  const sorted = [...leaderboard].sort((a, b) => b.xp - a.xp);
  const winner = sorted[0];

  return (
    <div className="panel match-end">
      <h2>🏆 Match over</h2>
      <p style={{ fontSize: 18 }}>
        <strong>{winner?.displayName ?? "Nobody"}</strong> wins with{" "}
        <span style={{ color: "var(--gold)" }}>{winner?.xp ?? 0} XP</span>
      </p>

      {/* Leaderboard */}
      <div className="match-leaderboard">
        {sorted.map((p, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
          return (
            <div
              key={p.id}
              className="match-lb-row"
              style={{ fontWeight: p.id === selfId ? 700 : 400 }}
            >
              <span className="match-lb-rank">{medal}</span>
              <span className="match-lb-name">
                {p.displayName}
                {p.id === selfId && <span className="small muted"> (you)</span>}
              </span>
              <span
                className="match-lb-xp"
                style={{ color: p.xp >= 0 ? "var(--ok)" : "var(--accent)" }}
              >
                {p.xp > 0 ? "+" : ""}{p.xp} XP
              </span>
            </div>
          );
        })}
      </div>

      {/* Titles */}
      {titles.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>Titles earned</h3>
          <div className="titles-grid">
            {titles.map((t) => {
              const player = leaderboard.find((p) => p.id === t.playerId);
              return (
                <div key={t.title} className="title-card">
                  <div className="title-emoji">{t.emoji}</div>
                  <div className="title-name">{t.title}</div>
                  <div className="title-player">{player?.displayName ?? "?"}</div>
                  <div className="title-desc">{t.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <p className="small muted">Room is back in lobby. Start another match or leave.</p>
      </div>
    </div>
  );
}

function phaseLabel(p: string): string {
  switch (p) {
    case "LOBBY": return "Lobby";
    case "CHARGE": return "The charge";
    case "ACCUSE": return "Prosecutors speak";
    case "DEFEND": return "Defense";
    case "JURY": return "Jury deliberates";
    case "VERDICT": return "Verdict";
    case "MATCH_END": return "Match over";
    default: return p;
  }
}
