import type { Phase } from "./phases";

export type PlayerId = string; // socket id or wallet address
export type RoomId = string;

export interface Player {
  id: PlayerId;
  displayName: string;
  xp: number;
  connected: boolean;
  clientId?: string;   // FIXED: #12 — stable identity across reconnects
}

export interface Charge {
  id: number;
  text: string;
}

export interface Accusation {
  accuser: PlayerId;
  text: string;
}

export interface Defense {
  defendant: PlayerId;
  text: string;
}

export type VerdictOutcome = "GUILTY" | "INNOCENT" | "CHAOTIC";

export interface PersonaVerdict {
  persona: string;
  verdict: VerdictOutcome;
  reasoning: string;
  confidence: number; // 1–10
}

export interface Verdict {
  defendant: PlayerId;
  outcome: VerdictOutcome;
  appealed: boolean;
  personas: PersonaVerdict[];
  xpDelta: Record<PlayerId, number>;
}

export interface RoundState {
  round: number; // 1-indexed
  defendant: PlayerId;
  charge: Charge;
  accusations: Accusation[];
  defense: Defense | null;
  verdict: Verdict | null;
}

export interface RoomState {
  id: RoomId;
  phase: Phase;
  phaseEndsAt: number | null; // unix ms
  currentRound: number;
  roundState: RoundState | null;
  players: Player[];
  hostId: PlayerId | null;
  history: Array<{ round: number; verdict: Verdict }>;
}

// ---- Event payload types (typed both sides) -------------------------------

export interface CreateRoomAck {
  roomId: RoomId;
}

export interface JoinRoomData {
  roomId: RoomId;
  displayName: string;
  clientId?: string;   // FIXED: #12 — stable identity across reconnects
}

export interface JoinRoomAck {
  ok: boolean;
  error?: string;
  playerId?: PlayerId;
}

export interface SubmitAccusationData {
  roomId: RoomId;
  text: string;
}

export interface SubmitDefenseData {
  roomId: RoomId;
  text: string;
}
