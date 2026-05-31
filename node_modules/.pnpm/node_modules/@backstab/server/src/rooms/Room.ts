import type { Server as SocketServer } from "socket.io";
import { keccak256, toBytes } from "viem";
import {
  Phase,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROUNDS_PER_MATCH,
  SEvent,
  computeTitles,
  type Accusation,
  type Charge,
  type Defense,
  type MatchTitle,
  type Player,
  type PlayerId,
  type RoomId,
  type RoomState,
  type RoundState,
  type Verdict,
} from "@backstab/shared";
import { PhaseMachine } from "./PhaseMachine.js";
import { runStubJury } from "../jury/stubJury.js";
import { getCharge, resetMatchCharges, disposeRoomCharges } from "../content/charges.js";
import {
  isContractConfigured,
  submitRoundToContract,
  appealRoundOnContract,
  createMatchOnContract,
  type ContractVerdict,
} from "../contract/client.js";
import {
  createBotId,
  pickBotPersonality,
  getBotAccusation,
  getBotDefense,
  type BotInfo,
} from "../bots/BotPlayer.js";

export class Room {
  private players = new Map<PlayerId, Player>();
  private machine = new PhaseMachine();
  private phaseTimer: NodeJS.Timeout | null = null;
  private phaseEndsAt: number | null = null;
  private hostId: PlayerId | null = null;

  private roundState: RoundState | null = null;
  private history: Array<{ round: number; verdict: Verdict }> = [];

  private defendantOrder: PlayerId[] = [];
  private matchId: number | null = null;
  private startingMatch = false;

  private walletMap = new Map<PlayerId, string>();
  private bots = new Map<PlayerId, BotInfo>();

  public onEmpty?: () => void;

  constructor(public readonly id: RoomId, private io: SocketServer) {}

  // ---- Lobby --------------------------------------------------------

  addPlayer(p: Player): { ok: true; playerId: PlayerId } | { ok: false; reason: string } {
    if (p.clientId) {
      for (const existing of this.players.values()) {
        if ((existing as any).clientId === p.clientId && !existing.connected) {
          this.players.delete(existing.id);
          if (this.walletMap.has(existing.id)) {
            const wallet = this.walletMap.get(existing.id)!;
            this.walletMap.delete(existing.id);
            this.walletMap.set(p.id, wallet);
          }
          const reclaimed = {
            ...existing,
            id: p.id,
            connected: true,
            clientId: p.clientId,
          };
          this.players.set(p.id, reclaimed);
          if (this.hostId === existing.id) {
            this.hostId = p.id;
          }
          this.defendantOrder = this.defendantOrder.map(x =>
            x === existing.id ? p.id : x);
          if (this.roundState) {
            if (this.roundState.defendant === existing.id) {
              this.roundState.defendant = p.id;
            }
            this.roundState.accusations = this.roundState.accusations.map(a =>
              a.accuser === existing.id ? { ...a, accuser: p.id } : a);
          }
          this.broadcastState();
          return { ok: true, playerId: p.id };
        }
      }
    }
    if (this.machine.phase !== Phase.LOBBY) {
      return { ok: false, reason: "match_in_progress" };
    }
    if (this.players.size >= MAX_PLAYERS) {
      return { ok: false, reason: "room_full" };
    }
    if (this.players.size === 0) this.hostId = p.id;
    this.players.set(p.id, p);
    this.broadcastState();
    return { ok: true, playerId: p.id };
  }

  removePlayer(id: PlayerId): void {
    const p = this.players.get(id);
    if (!p) return;
    if (this.machine.phase === Phase.LOBBY) {
      this.players.delete(id);
      if (this.hostId === id) this.hostId = this.players.keys().next().value ?? null;
    } else {
      this.players.set(id, { ...p, connected: false });
    }
    this.broadcastState();
    if (this.isEmptyAndIdle()) {
      this.onEmpty?.();
    }
  }

  canStart(requestingId: PlayerId): boolean {
    return (
      this.machine.phase === Phase.LOBBY &&
      this.players.size >= MIN_PLAYERS &&
      this.hostId === requestingId
    );
  }

  isHost(id: PlayerId): boolean {
    return this.hostId === id;
  }

  isEmptyAndIdle(): boolean {
    const anyHuman = Array.from(this.players.values())
      .some(p => p.connected && !this.bots.has(p.id));
    return !anyHuman && this.machine.phase === Phase.LOBBY;
  }

  registerWallet(playerId: PlayerId, walletAddress: string): void {
    this.walletMap.set(playerId, walletAddress);
  }

  private syntheticAddress(pid: PlayerId): string {
    const hash = keccak256(toBytes(`${this.id}:${pid}`));
    return "0x" + hash.slice(2, 42);
  }

  private getWallet(pid: PlayerId): string {
    return this.walletMap.get(pid) ?? this.syntheticAddress(pid);
  }

  addBots(targetCount: number = MIN_PLAYERS): { added: number } {
    if (this.machine.phase !== Phase.LOBBY) return { added: 0 };

    const usedNames = new Set(
      Array.from(this.players.values()).map((p) => p.displayName),
    );
    let added = 0;

    while (this.players.size < Math.min(targetCount, MAX_PLAYERS)) {
      const botId = createBotId();
      const personality = pickBotPersonality(usedNames);
      usedNames.add(personality.displayName);

      const player: Player = {
        id: botId,
        displayName: `🤖 ${personality.displayName}`,
        xp: 0,
        connected: true,
      };

      this.players.set(botId, player);
      this.bots.set(botId, { id: botId, personality });
      added++;
    }

    if (added > 0) this.broadcastState();
    return { added };
  }

  isBot(playerId: PlayerId): boolean {
    return this.bots.has(playerId);
  }

  // ---- Match lifecycle ----------------------------------------------

  async startMatch(): Promise<void> {
    if (this.machine.phase !== Phase.LOBBY) return;
    if (this.players.size < MIN_PLAYERS) return;
    if (this.startingMatch) return;
    this.startingMatch = true;

    resetMatchCharges(this.id);

    const ids = Array.from(this.players.keys());
    this.defendantOrder = shuffled(ids).slice(0, ROUNDS_PER_MATCH);
    while (this.defendantOrder.length < ROUNDS_PER_MATCH) {
      this.defendantOrder.push(
        ...shuffled(ids).slice(0, ROUNDS_PER_MATCH - this.defendantOrder.length),
      );
    }

    // If contract is configured, wait for create_match before starting
    // so that round 1 gets a real AI verdict instead of stub
    if (isContractConfigured()) {
      const playerWallets = ids.map((pid) => this.getWallet(pid));
      if (playerWallets.length >= MIN_PLAYERS) {
        try {
          this.matchId = await createMatchOnContract(playerWallets);
          console.log(`[Room ${this.id}] on-chain match id=${this.matchId}`);
        } catch (err) {
          console.error(`[Room ${this.id}] create_match failed, falling back to stub:`, err);
          this.matchId = null;
        }
      }
    }

    this.machine.startMatch();
    this.openRound();
    this.startPhaseTimer();
    this.broadcastState();
  }

  private openRound(): void {
    const defendant = this.defendantOrder[this.machine.round - 1];
    const charge: Charge = getCharge(this.id);
    this.roundState = {
      round: this.machine.round,
      defendant,
      charge,
      accusations: [],
      defense: null,
      verdict: null,
    };
    this.io.to(this.id).emit(SEvent.ROUND_STARTED, {
      round: this.machine.round,
      defendant,
      charge,
    });
  }

  // ---- Player input --------------------------------------------------

  submitAccusation(playerId: PlayerId, text: string): void {
    if (this.machine.phase !== Phase.ACCUSE) return;
    if (!this.roundState) return;
    if (playerId === this.roundState.defendant) return;
    const clean = text.trim().slice(0, 240);
    if (!clean) return;

    const existing = this.roundState.accusations.findIndex((a) => a.accuser === playerId);
    const acc: Accusation = { accuser: playerId, text: clean };
    if (existing >= 0) this.roundState.accusations[existing] = acc;
    else this.roundState.accusations.push(acc);

    this.io.to(this.id).emit(SEvent.ACCUSATION_RECEIVED, acc);

    const nonDefendants = this.players.size - 1;
    if (this.roundState.accusations.length >= nonDefendants) {
      this.advancePhase();
    }
  }

  submitDefense(playerId: PlayerId, text: string): void {
    if (this.machine.phase !== Phase.DEFEND) return;
    if (!this.roundState) return;
    if (playerId !== this.roundState.defendant) return;
    const clean = text.trim().slice(0, 300);
    if (!clean) return;
    this.roundState.defense = { defendant: playerId, text: clean };
    this.io.to(this.id).emit(SEvent.DEFENSE_RECEIVED, this.roundState.defense);
    this.advancePhase();
  }

  // ---- Phase loop ----------------------------------------------------

  private startPhaseTimer(): void {
    this.clearTimer();
    const duration = this.machine.phaseDurationMs();
    this.phaseEndsAt = duration > 0 ? Date.now() + duration : null;

    this.io.to(this.id).emit(SEvent.PHASE_CHANGE, {
      phase: this.machine.phase,
      round: this.machine.round,
      phaseEndsAt: this.phaseEndsAt,
    });

    if (this.machine.phase === Phase.ACCUSE) {
      this.runBotAccusations();
    } else if (this.machine.phase === Phase.DEFEND) {
      this.runBotDefense();
    }

    if (this.machine.phase === Phase.JURY) {
      this.runJuryAsync().catch((e) => {
        console.error(`[Room ${this.id}] runJuryAsync threw:`, e);
        if (this.roundState && !this.roundState.verdict) {
          this.roundState.verdict = this.runLocalStubJury(
            this.roundState,
            this.machine.round === ROUNDS_PER_MATCH,
          );
          this.io.to(this.id).emit(SEvent.VERDICT, this.roundState.verdict);
          this.advancePhase();
        }
      });
      this.phaseTimer = setTimeout(() => {
        if (this.machine.phase === Phase.JURY && this.roundState && !this.roundState.verdict) {
          console.warn(`[Room ${this.id}] JURY timeout — forcing stub`);
          this.roundState.verdict = this.runLocalStubJury(
            this.roundState,
            this.machine.round === ROUNDS_PER_MATCH,
          );
          this.io.to(this.id).emit(SEvent.VERDICT, this.roundState.verdict);
          this.advancePhase();
        }
      }, 2_100_000);
      return;
    }

    if (duration > 0) {
      this.phaseTimer = setTimeout(() => this.advancePhase(), duration);
    }
  }

  private advancePhase(): void {
    this.clearTimer();

    if (this.machine.phase === Phase.VERDICT && this.roundState?.verdict) {
      this.history.push({ round: this.roundState.round, verdict: this.roundState.verdict });
    }

    const next = this.machine.advance();

    if (next === Phase.MATCH_END) {
      this.endMatch();
      return;
    }

    if (next === Phase.CHARGE) {
      this.openRound();
    }

    this.startPhaseTimer();
    this.broadcastState();
  }

  // ---- Bot actions ---------------------------------------------------

  private runBotAccusations(): void {
    if (!this.roundState) return;
    const defendant = this.roundState.defendant;

    for (const [botId, bot] of this.bots) {
      if (botId === defendant) continue;

      const delay = 1000 + Math.random() * 3000;
      setTimeout(() => {
        if (this.machine.phase !== Phase.ACCUSE) return;
        const text = getBotAccusation(bot.personality.style);
        this.submitAccusation(botId, text);
      }, delay);
    }
  }

  private runBotDefense(): void {
    if (!this.roundState) return;
    const defendant = this.roundState.defendant;
    const bot = this.bots.get(defendant);
    if (!bot) return;

    const delay = 1000 + Math.random() * 2000;
    setTimeout(() => {
      if (this.machine.phase !== Phase.DEFEND) return;
      const text = getBotDefense(bot.personality.style);
      this.submitDefense(defendant, text);
    }, delay);
  }

  // ---- Jury execution ------------------------------------------------

  private async runJuryAsync(): Promise<void> {
    if (!this.roundState) return;
    const rs = this.roundState;
    const isFinal = this.machine.round === ROUNDS_PER_MATCH;

    const useContract = isContractConfigured() && this.matchId !== null;

    let verdict: Verdict;

    if (useContract) {
      try {
        verdict = await this.runContractJury(rs, isFinal);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Room ${this.id}] Contract jury FAILED round=${rs.round} — falling back to stub. Error: ${msg}`);
        verdict = this.runLocalStubJury(rs, isFinal);
      }
    } else {
      console.warn(`[Room ${this.id}] useContract=false (configured=${isContractConfigured()} matchId=${this.matchId}) — using stub`);
      verdict = this.runLocalStubJury(rs, isFinal);
    }

    // If the timeout already fired and set a stub verdict, don't overwrite it
    if (!this.roundState || this.roundState.verdict) {
  console.warn(`[Room ${this.id}] Verdict already set or round cleared (timeout fired), discarding late AI verdict`);
  return;
}

    rs.verdict = verdict;

    verdict.personas.forEach((p, idx) => {
      setTimeout(() => {
        this.io.to(this.id).emit(SEvent.JURY_BUBBLE, p);
      }, 800 + idx * 1800);
    });

    const totalBubbleTime = 800 + verdict.personas.length * 1800 + 500;
    setTimeout(() => {
      if (this.machine.phase !== Phase.JURY) return;
      this.io.to(this.id).emit(SEvent.VERDICT, verdict);

      for (const [pid, delta] of Object.entries(verdict.xpDelta)) {
        const p = this.players.get(pid);
        if (p) this.players.set(pid, { ...p, xp: p.xp + delta });
      }
      this.broadcastState();

      this.phaseEndsAt = Date.now() + 8000;
      this.io.to(this.id).emit(SEvent.PHASE_CHANGE, {
        phase: Phase.VERDICT,
        round: this.machine.round,
        phaseEndsAt: this.phaseEndsAt,
      });
      this.machine.phase = Phase.VERDICT;
      this.phaseTimer = setTimeout(() => this.advancePhase(), 8000);
    }, totalBubbleTime);
  }

  private async runContractJury(rs: RoundState, isFinal: boolean): Promise<Verdict> {
    const accusationsForContract = rs.accusations.map((a) => ({
      accuser: this.getWallet(a.accuser),
      text: a.text,
    }));

    console.log(`[Room ${this.id}] Calling contract submit_round (round ${rs.round})...`);

    if (this.matchId === null) {
      throw new Error("matchId is null — create_match was not called");
    }

    const contractVerdict = await submitRoundToContract({
      matchId: this.matchId,
      roundNumber: rs.round,
      chargeText: rs.charge.text,
      defendantAddress: this.getWallet(rs.defendant),
      accusationsJson: JSON.stringify(accusationsForContract),
      defenseText: rs.defense?.text ?? "",
    });

    console.log(`[Room ${this.id}] Contract verdict: ${contractVerdict.outcome} (appealed: ${contractVerdict.appealed})`);

    // Skip appeal contract call — use the initial AI verdict directly.
    // The appeal was causing a second long-running contract call that timed
    // out and triggered the stub fallback, overwriting the real AI verdict.
    if (contractVerdict.appealed) {
      console.log(`[Room ${this.id}] Round appealed — using initial AI verdict directly (skipping appeal call)`);
    }

    return this.mapContractVerdict(contractVerdict, rs.defendant);
  }

  private mapContractVerdict(cv: ContractVerdict, defendantSocketId: PlayerId): Verdict {
    const reverseWallet = new Map<string, PlayerId>();
    for (const [socketId, wallet] of this.walletMap.entries()) {
      reverseWallet.set(wallet, socketId);
    }
    for (const pid of this.players.keys()) {
      reverseWallet.set(this.syntheticAddress(pid), pid);
    }
    for (const pid of this.players.keys()) {
      reverseWallet.set(pid, pid);
    }

    const mapAddr = (addr: string): PlayerId => reverseWallet.get(addr) ?? addr;

    const xpDelta: Record<PlayerId, number> = {};
    for (const [addr, delta] of Object.entries(cv.xp_delta)) {
      xpDelta[mapAddr(addr)] = delta;
    }

    return {
      defendant: defendantSocketId,
      outcome: cv.outcome as "GUILTY" | "INNOCENT" | "CHAOTIC",
      appealed: cv.appealed,
      personas: cv.personas.map((p) => ({
        persona: p.persona,
        verdict: p.verdict as "GUILTY" | "INNOCENT" | "CHAOTIC",
        reasoning: p.reasoning,
        confidence: p.confidence,
      })),
      xpDelta,
    };
  }

  private runLocalStubJury(rs: RoundState, isFinal: boolean): Verdict {
    return runStubJury(rs.defendant, rs.accusations, rs.defense, {
      doubleStake: isFinal,
    });
  }

  // ---- Match end -----------------------------------------------------

  private endMatch(): void {
    this.clearTimer();
    this.phaseEndsAt = null;

    const titles = computeTitles(
      this.history,
      Array.from(this.players.keys()),
    );

    this.io.to(this.id).emit(SEvent.MATCH_END, {
      leaderboard: this.leaderboard(),
      history: this.history,
      titles,
    });
    this.machine = new PhaseMachine(Phase.LOBBY, 0);
    this.roundState = null;
    this.history = [];
    this.matchId = null;
    this.startingMatch = false;
    disposeRoomCharges(this.id);
    this.broadcastState();
  }

  private clearTimer(): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  // ---- Snapshot ------------------------------------------------------

  snapshot(): RoomState {
    return {
      id: this.id,
      phase: this.machine.phase,
      phaseEndsAt: this.phaseEndsAt,
      currentRound: this.machine.round,
      roundState: this.roundState,
      players: Array.from(this.players.values()),
      hostId: this.hostId,
      history: this.history,
    };
  }

  private leaderboard(): Player[] {
    return Array.from(this.players.values()).sort((a, b) => b.xp - a.xp);
  }

  private broadcastState(): void {
    this.io.to(this.id).emit(SEvent.ROOM_STATE, this.snapshot());
  }
}

// ---- utils ----------------------------------------------------------

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}