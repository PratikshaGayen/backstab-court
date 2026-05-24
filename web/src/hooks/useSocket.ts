import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "../lib/socket";

export function useSocket() {
  const [socket] = useState<Socket>(() => getSocket());
  const [connected, setConnected] = useState<boolean>(socket.connected);

  useEffect(() => {
    const onC = () => setConnected(true);
    const onD = () => setConnected(false);
    socket.on("connect", onC);
    socket.on("disconnect", onD);
    return () => {
      socket.off("connect", onC);
      socket.off("disconnect", onD);
    };
  }, [socket]);

  return { socket, connected };
}
