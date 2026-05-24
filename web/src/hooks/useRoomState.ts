import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  SEvent,
  type MatchTitle,
  type PersonaVerdict,
  type RoomState,
  type Verdict,
} from "@backstab/shared";

export interface LiveRoomState {
  room: RoomState | null;
  juryBubbles: PersonaVerdict[];
  lastVerdict: Verdict | null;
  matchEnd: {
    leaderboard: RoomState["players"];
    history: Array<{ round: number; verdict: Verdict }>;
    titles: MatchTitle[];
  } | null;
  lastError: string | null;
}

export function useRoomState(socket: Socket | null): LiveRoomState {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [juryBubbles, setJuryBubbles] = useState<PersonaVerdict[]>([]);
  const [lastVerdict, setLastVerdict] = useState<Verdict | null>(null);
  const [matchEnd, setMatchEnd] = useState<LiveRoomState["matchEnd"]>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    const onRoomState = (s: RoomState) => {
      setRoom(s);
      if (s.phase === "CHARGE") {
        // New round — reset per-round UI
        setJuryBubbles([]);
        setLastVerdict(null);
      }
    };
    const onBubble = (p: PersonaVerdict) => {
      setJuryBubbles((prev) => [...prev, p]);
    };
    const onVerdict = (v: Verdict) => setLastVerdict(v);
    const onMatchEnd = (m: LiveRoomState["matchEnd"]) => setMatchEnd(m);
    const onError = (e: { code?: string }) => setLastError(e?.code ?? "unknown");

    socket.on(SEvent.ROOM_STATE, onRoomState);
    socket.on(SEvent.JURY_BUBBLE, onBubble);
    socket.on(SEvent.VERDICT, onVerdict);
    socket.on(SEvent.MATCH_END, onMatchEnd);
    socket.on(SEvent.ERROR, onError);

    return () => {
      socket.off(SEvent.ROOM_STATE, onRoomState);
      socket.off(SEvent.JURY_BUBBLE, onBubble);
      socket.off(SEvent.VERDICT, onVerdict);
      socket.off(SEvent.MATCH_END, onMatchEnd);
      socket.off(SEvent.ERROR, onError);
    };
  }, [socket]);

  return { room, juryBubbles, lastVerdict, matchEnd, lastError };
}
