import { useEffect, useState } from "react";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { storage } from "../lib/storage";   // FIXED: #17

type Client = ReturnType<typeof createClient>;

const ENDPOINT =
  import.meta.env.VITE_GENLAYER_RPC_URL ?? "http://localhost:4000/api";
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as
  | `0x${string}`
  | undefined;
const PK_KEY = "bc_private_key";

function getStoredAccount() {
  const saved = storage.get(PK_KEY);          // FIXED: #17
  if (saved?.startsWith("0x")) {
    try {
      return createAccount(saved as `0x${string}`);
    } catch {
      storage.remove(PK_KEY);                 // FIXED: #17
    }
  }
  const pk = generatePrivateKey();
  storage.set(PK_KEY, pk);                    // FIXED: #17
  return createAccount(pk);
}

/**
 * Wire the web client to the contract. Phase 1 mounts this for later use;
 * Phase 2 will call readContract/writeContract for real.
 */
export function useGenLayer() {
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    const acc = getStoredAccount();
    const c = createClient({ chain: studionet, endpoint: ENDPOINT, account: acc });

    // eth_gasPrice patch — see Predikt reference §11.
    const patched = c as unknown as {
      request: (args: { method: string }) => Promise<unknown>;
    };
    const orig = patched.request.bind(c);
    patched.request = async (args: { method: string }) => {
      if (args.method === "eth_gasPrice") {
        const r = await orig(args);
        return r ?? "0x1";
      }
      return orig(args);
    };

    setClient(c);
  }, []);

  type CalldataArg =
    | null
    | boolean
    | number
    | bigint
    | string
    | Uint8Array
    | Array<CalldataArg>
    | { [key: string]: CalldataArg };

  const readContract = async (functionName: string, args: CalldataArg[] = []) => {
    if (!client || !CONTRACT_ADDRESS) throw new Error("client_not_ready");
    return await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName,
      args,
    });
  };

  const writeContract = async (functionName: string, args: CalldataArg[] = []) => {
    if (!client || !CONTRACT_ADDRESS) throw new Error("client_not_ready");
    // NOTE: genlayer-js 1.1.8 requires `value: bigint` in the type, but the
    // Predikt reference warns that passing it can trigger a BigInt(undefined)
    // bug in certain flows. We pass 0n explicitly; if we hit issues in Phase 2
    // we'll revisit with a cast.
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName,
      args,
      value: 0n,
    });
    const receipt = await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.FINALIZED,
      interval: 3000,
      retries: 120,
    });
    return receipt;
  };

  return {
    client,
    readContract,
    writeContract,
    address: client?.account?.address as `0x${string}` | undefined,
  };
}
