import type { Server as SocketServer } from "socket.io";
import { nanoid } from "nanoid";
import type { RoomId } from "@backstab/shared";
import { Room } from "./Room.js";
import { disposeRoomCharges } from "../content/charges.js";   // FIXED: #15

export class RoomManager {
  private rooms = new Map<RoomId, Room>();
  private cleanupTimers = new Map<RoomId, NodeJS.Timeout>();   // FIXED: #15

  constructor(private io: SocketServer) {}

  createRoom(): Room {
    const id = nanoid(6).toUpperCase();
    const room = new Room(id, this.io);
    this.rooms.set(id, room);
    return room;
  }

  getRoom(id: RoomId): Room | undefined {
    return this.rooms.get(id);
  }

  deleteRoom(id: RoomId): void {
    this.rooms.delete(id);
  }

  roomCount(): number {
    return this.rooms.size;
  }

  scheduleCleanup(id: RoomId): void {                          // FIXED: #15
    this.cancelCleanup(id);                                    // FIXED: #15
    const t = setTimeout(() => {                               // FIXED: #15
      const room = this.rooms.get(id);                         // FIXED: #15
      if (!room) return;                                       // FIXED: #15
      if (room.isEmptyAndIdle()) {                             // FIXED: #15
        console.log(`[rooms] deleting idle room ${id}`);       // FIXED: #15
        disposeRoomCharges(id);                                // FIXED: #15
        this.rooms.delete(id);                                 // FIXED: #15
      }                                                        // FIXED: #15
      this.cleanupTimers.delete(id);                           // FIXED: #15
    }, 60_000);                                                // FIXED: #15
    this.cleanupTimers.set(id, t);                             // FIXED: #15
  }                                                            // FIXED: #15

  cancelCleanup(id: RoomId): void {                            // FIXED: #15
    const t = this.cleanupTimers.get(id);                      // FIXED: #15
    if (t) { clearTimeout(t); this.cleanupTimers.delete(id); } // FIXED: #15
  }                                                            // FIXED: #15
}
