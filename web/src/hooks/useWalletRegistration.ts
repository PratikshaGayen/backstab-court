import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import { useGenLayer } from "./useGenLayer";

/**
 * Auto-registers the player's GenLayer wallet address with the game server
 * when they join a room. This allows the server to map socket IDs to
 * on-chain addresses for contract calls.
 */
export function useWalletRegistration(socket: Socket | null, roomId: string | undefined) {
  const { address } = useGenLayer();

  useEffect(() => {
    if (!socket || !roomId || !address) return;

    socket.emit(
      "c:register_wallet",
      { roomId, walletAddress: address },
      (resp: { ok: boolean }) => {
        if (resp?.ok) {
          console.log(`[wallet] registered ${address.slice(0, 10)}... with server`);
        }
      },
    );
  }, [socket, roomId, address]);
}
