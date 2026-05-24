import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";
import { useGenLayer } from "../hooks/useGenLayer";   // FIXED: #12
import { CEvent } from "@backstab/shared";
import { getDisplayName } from "../lib/identity";

export default function Lobby() {
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const { address: walletAddress } = useGenLayer();   // FIXED: #12
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const create = () => {
    setError(null);
    setCreating(true);
    socket.emit(CEvent.CREATE_ROOM, {}, (resp: { roomId?: string }) => {
      setCreating(false);
      if (resp?.roomId) {
        join(resp.roomId);
      }
    });
  };

  const join = (roomId: string) => {
    setError(null);
    const displayName = getDisplayName();
    socket.emit(
      CEvent.JOIN_ROOM,
      { roomId, displayName, clientId: walletAddress ?? undefined },   // FIXED: #12
      (resp: { ok: boolean; error?: string }) => {
        if (resp?.ok) {
          navigate(`/room/${roomId}`);
        } else {
          setError(
            resp?.error === "room_full" ? "Room is full (max 6 players)" :
            resp?.error === "room_not_found" ? "Room not found. Check the code." :
            resp?.error === "match_in_progress" ? "Match already started. Try spectating instead." :
            resp?.error ?? "Could not join"
          );
        }
      },
    );
  };

  const spectate = (roomId: string) => {
    setError(null);
    socket.emit(
      CEvent.SPECTATE_ROOM,
      { roomId },
      (resp: { ok: boolean; error?: string }) => {
        if (resp?.ok) {
          navigate(`/room/${roomId}?spectator=1`);
        } else {
          setError(resp?.error === "room_not_found" ? "Room not found." : resp?.error ?? "Cannot spectate");
        }
      },
    );
  };

  return (
    <div className="container">
      <div className="lobby-header">
        <Link to="/" className="back-link">← Back</Link>
        <h2>Lobby</h2>
        <div className={`connection-dot ${connected ? "online" : ""}`}>
          {connected ? "Connected" : "Connecting..."}
        </div>
      </div>

      <div className="lobby-grid">
        <div className="panel lobby-create">
          <h3>Create a room</h3>
          <p className="muted small">You'll be the host. Share the code with friends.</p>
          <button onClick={create} disabled={!connected || creating} className="btn-primary btn-lg">
            {creating ? "Creating..." : "Create room"}
          </button>
        </div>

        <div className="panel lobby-join">
          <h3>Join a room</h3>
          <p className="muted small">Enter the 6-letter code from your host.</p>
          <div className="lobby-code-row">
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 6)); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && code.length >= 4) join(code); }}
              placeholder="ABC123"
              className="code-input"
              maxLength={6}
            />
          </div>
          <div className="lobby-btn-row">
            <button disabled={code.length < 4 || !connected} onClick={() => join(code)} className="btn-primary">
              Join
            </button>
            <button disabled={code.length < 4 || !connected} onClick={() => spectate(code)} className="btn-ghost">
              Watch
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="lobby-tips panel">
        <h4>Quick rules</h4>
        <ul>
          <li>4-6 players needed to start</li>
          <li>Each round, one player is on trial for an absurd crime</li>
          <li>Everyone else writes an accusation, defendant writes a defense</li>
          <li>An AI jury of 5 personas votes GUILTY / INNOCENT / CHAOTIC</li>
          <li>Final round is double XP. Highest XP wins.</li>
        </ul>
      </div>
    </div>
  );
}
