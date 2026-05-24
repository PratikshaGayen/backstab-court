import type { Server as SocketServer, Socket } from "socket.io";
import {
  CEvent,
  SEvent,
  type JoinRoomData,
  type SubmitAccusationData,
  type SubmitDefenseData,
} from "@backstab/shared";
import type { RoomManager } from "../rooms/RoomManager.js";

interface SocketContext {
  roomId?: string;
  playerId?: string;
  isSpectator?: boolean;
}

const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;   // FIXED: #22

export function attachGateway(io: SocketServer, rooms: RoomManager): void {
  io.on("connection", (socket: Socket) => {
    const ctx: SocketContext = {};
    console.log(`[ws] connected ${socket.id}`);

    socket.on(CEvent.CREATE_ROOM, (_data, ack?: (r: unknown) => void) => {
      const room = rooms.createRoom();
      room.onEmpty = () => rooms.scheduleCleanup(room.id);  // FIXED: #15
      ack?.({ roomId: room.id });
    });

    socket.on(CEvent.JOIN_ROOM, (data: JoinRoomData, ack?: (r: unknown) => void) => {
      const room = rooms.getRoom(data.roomId);
      if (!room) {
        ack?.({ ok: false, error: "room_not_found" });
        return;
      }
      const playerId = socket.id;
      const result = room.addPlayer({
        id: playerId,
        displayName: data.displayName.trim().slice(0, 24) || "Anon",
        xp: 0,
        connected: true,
        clientId: data.clientId,   // FIXED: #12
      });
      if (!result.ok) {
        ack?.({ ok: false, error: result.reason });
        return;
      }
      rooms.cancelCleanup(data.roomId);   // FIXED: #15
      ctx.roomId = data.roomId;
      ctx.playerId = playerId;
      socket.join(data.roomId);
      socket.emit(SEvent.ROOM_STATE, room.snapshot());
      ack?.({ ok: true, playerId });
    });

    // Spectator mode: join a room as a viewer (no player slot consumed)
    socket.on(CEvent.SPECTATE_ROOM, (data: { roomId: string }, ack?: (r: unknown) => void) => {
      const room = rooms.getRoom(data.roomId);
      if (!room) {
        ack?.({ ok: false, error: "room_not_found" });
        return;
      }
      ctx.roomId = data.roomId;
      ctx.isSpectator = true;
      socket.join(data.roomId);
      socket.emit(SEvent.ROOM_STATE, room.snapshot());
      ack?.({ ok: true, spectator: true });
    });

    // Register wallet address for on-chain interactions
    socket.on("c:register_wallet", (data: { roomId: string; walletAddress: string }, ack?: (r: unknown) => void) => {
      if (!ctx.roomId || !ctx.playerId) {
        ack?.({ ok: false, error: "not_in_room" });
        return;
      }
      const room = rooms.getRoom(ctx.roomId);
      if (!room) {
        ack?.({ ok: false, error: "room_not_found" });
        return;
      }
      if (!WALLET_REGEX.test(data?.walletAddress ?? "")) {       // FIXED: #22
        ack?.({ ok: false, error: "invalid_address" });          // FIXED: #22
        return;                                                  // FIXED: #22
      }                                                          // FIXED: #22
      room.registerWallet(ctx.playerId, data.walletAddress);
      ack?.({ ok: true });
    });

    socket.on(CEvent.START_MATCH, () => {
      if (!ctx.roomId || !ctx.playerId) return;
      const room = rooms.getRoom(ctx.roomId);
      if (!room) return;
      if (!room.canStart(ctx.playerId)) {
        socket.emit(SEvent.ERROR, { code: "cannot_start" });
        return;
      }
      room.startMatch().catch((e) => console.error("startMatch failed:", e));  // FIXED: #3
    });

    socket.on("c:add_bots", (data: { count?: number } | undefined, ack?: (r: unknown) => void) => {
      if (!ctx.roomId || !ctx.playerId) {
        ack?.({ ok: false, error: "not_in_room" });
        return;
      }
      const room = rooms.getRoom(ctx.roomId);
      if (!room) {
        ack?.({ ok: false, error: "room_not_found" });
        return;
      }
      if (!room.isHost(ctx.playerId)) {                          // FIXED: #18
        ack?.({ ok: false, error: "not_host" });                 // FIXED: #18
        return;                                                  // FIXED: #18
      }                                                          // FIXED: #18
      const target = data?.count ?? 4;
      const result = room.addBots(target);
      ack?.({ ok: true, added: result.added });
    });

    socket.on(CEvent.SUBMIT_ACCUSATION, (data: SubmitAccusationData) => {
      if (!ctx.roomId || !ctx.playerId) return;
      const room = rooms.getRoom(data.roomId ?? ctx.roomId);
      if (!room) return;
      room.submitAccusation(ctx.playerId, data.text);
    });

    socket.on(CEvent.SUBMIT_DEFENSE, (data: SubmitDefenseData) => {
      if (!ctx.roomId || !ctx.playerId) return;
      const room = rooms.getRoom(data.roomId ?? ctx.roomId);
      if (!room) return;
      room.submitDefense(ctx.playerId, data.text);
    });

    socket.on(CEvent.LEAVE_ROOM, () => {
      if (!ctx.roomId || !ctx.playerId) return;
      const room = rooms.getRoom(ctx.roomId);
      room?.removePlayer(ctx.playerId);
      socket.leave(ctx.roomId);
      ctx.roomId = undefined;
    });

    socket.on("disconnect", () => {
      console.log(`[ws] disconnected ${socket.id}`);
      if (ctx.roomId && ctx.playerId) {
        const room = rooms.getRoom(ctx.roomId);
        room?.removePlayer(ctx.playerId);
      }
    });
  });
}
