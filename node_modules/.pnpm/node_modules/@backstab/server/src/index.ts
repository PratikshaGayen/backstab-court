import { config as dotenvConfig } from "dotenv";   // FIXED: env-load
import { dirname, resolve } from "node:path";       // FIXED: env-load
import { fileURLToPath } from "node:url";           // FIXED: env-load

// Load the project-root .env regardless of which directory tsx was launched from.
const __dirname = dirname(fileURLToPath(import.meta.url));   // FIXED: env-load
dotenvConfig({ path: resolve(__dirname, "..", "..", ".env") });   // FIXED: env-load

import http from "node:http";
import express from "express";
import cors from "cors";
import { Server as SocketServer } from "socket.io";
import { attachGateway } from "./sockets/gateway.js";
import { RoomManager } from "./rooms/RoomManager.js";

const PORT = Number(process.env.PORT ?? 4100);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, rooms: roomManager.roomCount() });
});

const httpServer = http.createServer(app);

const io = new SocketServer(httpServer, {
  cors: { origin: CORS_ORIGIN },
});

const roomManager = new RoomManager(io);
attachGateway(io, roomManager);

httpServer.listen(PORT, () => {
  console.log(`[backstab-server] listening on :${PORT}`);
  console.log(`[backstab-server] cors origin: ${CORS_ORIGIN}`);
  console.log(`[backstab-server] contract address: ${process.env.CONTRACT_ADDRESS ?? "(unset — stub jury only)"}`);   // FIXED: env-load
  console.log(`[backstab-server] genlayer rpc:    ${process.env.GENLAYER_RPC_URL ?? "(unset)"}`);                       // FIXED: env-load
});
