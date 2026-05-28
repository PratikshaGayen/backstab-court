/**
 * Deploy backstab_court.py to Bradbury testnet and call set_game_server().
 *
 * Usage:
 *   cd d:\Genlayer-Game
 *   npx tsx contract/deploy/deploy.ts
 *
 * Required env vars (loaded from .env at repo root):
 *   GENLAYER_RPC_URL      – Bradbury RPC endpoint
 *   SERVER_PRIVATE_KEY    – deployer / server wallet private key
 *
 * Optional:
 *   GAME_SERVER_ADDRESS   – if set, used as the authorized game-server address
 *                           instead of deriving it from SERVER_PRIVATE_KEY
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __dir = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(__dir, "..", "backstab_court.py");

const RPC = process.env.GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api";
const PK = (process.env.SERVER_PRIVATE_KEY ?? generatePrivateKey()) as `0x${string}`;

const account = createAccount(PK);
console.log(`\n[deploy] Deployer address : ${account.address}`);
console.log(`[deploy] RPC               : ${RPC}`);
console.log(`[deploy] Chain             : ${studionet.name} (id=${studionet.id})\n`);

const client = createClient({ chain: studionet, endpoint: RPC, account });

// ── Gas-price shim (same as server client) ────────────────────────────────
const patched = client as unknown as { request: (a: { method: string }) => Promise<unknown> };
const origRequest = patched.request.bind(client);
patched.request = async (a) => {
  if (a.method === "eth_gasPrice") return (await origRequest(a)) ?? "0x1";
  return origRequest(a);
};

async function deploy() {
  const code = readFileSync(CONTRACT_PATH, "utf-8");
  console.log(`[deploy] Deploying ${CONTRACT_PATH} (${code.length} bytes)…`);

  const hash = await client.deployContract({
    code,
    args: [],
  });
  console.log(`[deploy] Deploy tx hash: ${hash}`);

  console.log(`[deploy] Waiting for finalization (retries=200, interval=5s)…`);
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    interval: 5000,
    retries: 200,
  });

  const r = receipt as any;
  // Bradbury receipt path
  const contractAddress: string =
    r.txDataDecoded?.contractAddress ??
    r.data?.contract_address ??
    r.contractAddress ??
    r.contract_address;

  if (!contractAddress) {
    console.error("[deploy] Full receipt:", JSON.stringify(r, null, 2));
    throw new Error("Cannot extract contract address from receipt");
  }

  console.log(`\n[deploy] ✓ Contract deployed at: ${contractAddress}`);
  console.log(`[deploy] Explorer: https://explorer-bradbury.genlayer.com/address/${contractAddress}\n`);

  // ── Authorize the game server ──────────────────────────────────────────
  const serverAddress: string =
    (process.env.GAME_SERVER_ADDRESS as string | undefined) ?? account.address;

  console.log(`[deploy] Calling set_game_server(${serverAddress})…`);
  const authHash = await client.writeContract({
    address: contractAddress as `0x${string}`,
    functionName: "set_game_server",
    args: [serverAddress],
    value: 0n,
  });
  console.log(`[deploy] set_game_server tx hash: ${authHash}`);

  const authReceipt = await client.waitForTransactionReceipt({
    hash: authHash,
    status: TransactionStatus.FINALIZED,
    interval: 5000,
    retries: 200,
  });
  const ar = authReceipt as any;
  console.log(`[deploy] set_game_server status: ${ar.status_name ?? ar.status}`);

  // ── Print .env instructions ────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("Update your .env with:");
  console.log(`  CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`  VITE_CONTRACT_ADDRESS=${contractAddress}`);
  console.log("─────────────────────────────────────────────────────────\n");

  return contractAddress;
}

deploy().catch((err) => {
  console.error("[deploy] FAILED:", err);
  process.exit(1);
});
