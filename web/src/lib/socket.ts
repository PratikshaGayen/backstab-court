import { io, type Socket } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4100";

let cached: Socket | null = null;

/**
 * Single shared socket for the tab. We keep one connection across pages
 * so navigation doesn't drop the player out of their room.
 */
export function getSocket(): Socket {
  if (cached && cached.connected) return cached;
  if (cached) return cached;
  cached = io(SERVER_URL, { transports: ["websocket"], autoConnect: true });
  return cached;
}
