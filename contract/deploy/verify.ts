/**
 * Verify the Bradbury migration is working end-to-end.
 *
 * Usage:
 *   cd d:\Genlayer-Game
 *   npx tsx contract/deploy/verify.ts
 *
 * Checks:
 *   1. RPC reachable on Bradbury
 *   2. Contract responds to read calls (get_match_count)
 *   3. createMatch() succeeds and returns a numeric match ID
 *   4. get_match_state() returns valid state for that match ID
 */
import "dotenv/config";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const RPC = process.env.GENLAYER_RPC_URL ?? "https://rpc-bradbury.genlayer.com";
const PK = (process.env.SERVER_PRIVATE_KEY ?? generatePrivateKey()) as `0x${string}`;
const CONTRACT = process.env.CONTRACT_ADDRESS as `0x${string}` | undefined;

if (!CONTRACT) {
  console.error("[verify] CONTRACT_ADDRESS is not set in .env");
  process.exit(1);
}

const account = createAccount(PK);
const client = createClient({ chain: testnetBradbury, endpoint: RPC, account });

const patched = client as unknown as { request: (a: { method: string }) => Promise<unknown> };
const origRequest = patched.request.bind(client);
patched.request = async (a) => {
  if (a.method === "eth_gasPrice") return (await origRequest(a)) ?? "0x1";
  return origRequest(a);
};

let passed = 0;
let failed = 0;

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
  passed++;
}
function fail(msg: string, err?: unknown) {
  console.error(`  ✗ ${msg}`);
  if (err) console.error("   ", err);
  failed++;
}

async function run() {
  console.log(`\n[verify] Backstab Court — Bradbury migration check`);
  console.log(`[verify] RPC      : ${RPC}`);
  console.log(`[verify] Contract : ${CONTRACT}`);
  console.log(`[verify] Wallet   : ${account.address}\n`);

  // ── 1. RPC reachability ───────────────────────────────────────────────
  console.log("1. RPC reachability");
  try {
    await (client as any).request({ method: "eth_chainId" });
    ok(`Connected to chain id ${testnetBradbury.id}`);
  } catch (e) {
    fail("Cannot reach Bradbury RPC", e);
  }

  // ── 2. Read contract ──────────────────────────────────────────────────
  console.log("\n2. Contract read (get_match_count)");
  try {
    const count = await client.readContract({
      address: CONTRACT!,
      functionName: "get_match_count",
      args: [],
    });
    ok(`get_match_count returned: ${count}`);
  } catch (e) {
    fail("get_match_count failed", e);
  }

  // ── 3. createMatch() write ─────────────────────────────────────────────
  console.log("\n3. createMatch() write transaction");
  let matchId: number | undefined;
  try {
    const testPlayers = [account.address, "0x000000000000000000000000000000000000dEaD"];
    const hash = await client.writeContract({
      address: CONTRACT!,
      functionName: "create_match",
      args: [JSON.stringify(testPlayers)],
      value: 0n,
    });
    ok(`Submitted tx: ${hash}`);

    console.log("   Waiting for finalization (retries=200)…");
    const receipt = await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.FINALIZED,
      interval: 5000,
      retries: 200,
    });

    const r = receipt as any;
    const rawId =
      r.txDataDecoded?.match_id ??
      r.txDataDecoded ??
      r.decoded_data?.match_id ??
      r.decoded_data ??
      r.consensus_data?.leader_receipt?.[0]?.result?.payload?.readable;

    matchId = typeof rawId === "number" ? rawId : parseInt(String(rawId), 10);

    if (isNaN(matchId)) {
      fail(`Cannot parse match_id from receipt. Raw: ${JSON.stringify(rawId)?.slice(0, 200)}`);
    } else {
      ok(`create_match returned match_id=${matchId}`);
    }
  } catch (e) {
    fail("create_match failed", e);
  }

  // ── 4. get_match_state() read ─────────────────────────────────────────
  if (matchId !== undefined && !isNaN(matchId)) {
    console.log(`\n4. get_match_state(${matchId}) read`);
    try {
      const state = await client.readContract({
        address: CONTRACT!,
        functionName: "get_match_state",
        args: [matchId],
      });
      ok(`get_match_state returned: ${JSON.stringify(state)?.slice(0, 200)}`);
    } catch (e) {
      fail("get_match_state failed", e);
    }
  } else {
    console.log("\n4. get_match_state — skipped (no valid match_id)");
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`\n─────────────────────────────────────────────────────────`);
  console.log(`[verify] Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("[verify] Migration has issues — review errors above.");
    process.exit(1);
  } else {
    console.log("[verify] All checks passed — Bradbury migration looks good!");
  }
}

run().catch((err) => {
  console.error("[verify] Unexpected error:", err);
  process.exit(1);
});
