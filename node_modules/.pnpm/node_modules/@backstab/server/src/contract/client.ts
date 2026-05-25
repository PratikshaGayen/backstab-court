/**
 * Server-side GenLayer client.
 */
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { testnet_asimov } from "genlayer-js/chains";

const bradbury = {
  ...testnet_asimov,
  name: "GenLayer Testnet Bradbury",
  rpcUrls: {
    default: { http: ["https://rpc-bradbury.genlayer.com"] },
    public: { http: ["https://rpc-bradbury.genlayer.com"] },
  },
};
import { TransactionStatus } from "genlayer-js/types";

let cached: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (cached) return cached;

  const RPC = process.env.GENLAYER_RPC_URL ?? "http://localhost:4000/api";

  const pk = (process.env.SERVER_PRIVATE_KEY as `0x${string}`) ?? generatePrivateKey();
  const account = createAccount(pk);
  console.log(`[contract] server address: ${account.address}`);

  const client = createClient({ chain: bradbury, endpoint: RPC, account });

  const c = client as unknown as { request: (args: { method: string }) => Promise<unknown> };
  const orig = c.request.bind(client);
  c.request = async (args: { method: string }) => {
    if (args.method === "eth_gasPrice") {
      const r = await orig(args);
      return r ?? "0x1";
    }
    return orig(args);
  };

  cached = client;
  return client;
}

function getAddress(): `0x${string}` {
  const addr = process.env.CONTRACT_ADDRESS as `0x${string}` | undefined;
  if (!addr) {
    throw new Error("[contract] CONTRACT_ADDRESS env var not set");
  }
  return addr;
}

export interface ContractVerdict {
  defendant: string;
  outcome: "GUILTY" | "INNOCENT" | "CHAOTIC";
  appealed: boolean;
  personas: Array<{
    persona: string;
    verdict: string;
    reasoning: string;
    confidence: number;
  }>;
  xp_delta: Record<string, number>;
  supreme?: {
    persona: string;
    verdict: string;
    reasoning: string;
  };
}

function extractFromRaw(raw: unknown): any {
  if (!raw || raw === "null") return undefined;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      // GenLayer sometimes emits malformed JSON — signal caller to do regex extraction
      return null;
    }
  }
  return undefined;
}

/**
 * Last-resort extraction of a ContractVerdict from a malformed JSON string.
 * GenLayer's payload.readable can be missing commas or have other minor corruption.
 * We extract each top-level field we care about via individual regex passes,
 * then assemble a best-effort verdict object.
 */
function extractVerdictFromMalformedJson(raw: string): ContractVerdict | null {
  console.warn(`[contract] submit_round attempting regex extraction from malformed JSON`);
  console.warn(`[contract] malformed payload (first 500 chars): ${raw.slice(0, 500)}`);

  // ── outcome ──────────────────────────────────────────────────────────────
  const outcomeMatch = raw.match(/"outcome"\s*:\s*"(GUILTY|INNOCENT|CHAOTIC)"/);
  if (!outcomeMatch) {
    console.error(`[contract] regex extraction: cannot find outcome in payload`);
    return null;
  }
  const outcome = outcomeMatch[1] as "GUILTY" | "INNOCENT" | "CHAOTIC";

  // ── defendant ────────────────────────────────────────────────────────────
  const defendantMatch = raw.match(/"defendant"\s*:\s*"([^"]+)"/);
  const defendant = defendantMatch?.[1] ?? "";

  // ── appealed ─────────────────────────────────────────────────────────────
  const appealedMatch = raw.match(/"appealed"\s*:\s*(true|false)/);
  const appealed = appealedMatch?.[1] === "true";

  // ── xp_delta — extract all "0x...": <number> pairs inside xp_delta block ──
  const xpDelta: Record<string, number> = {};
  const xpBlockMatch = raw.match(/"xp_delta"\s*:\s*\{([^}]*)\}/);
  if (xpBlockMatch) {
    const pairs = xpBlockMatch[1].matchAll(/"([^"]+)"\s*:\s*(-?\d+)/g);
    for (const [, addr, val] of pairs) {
      xpDelta[addr] = parseInt(val, 10);
    }
  }

  // ── personas — best-effort: grab all persona/verdict/reasoning/confidence blocks ──
  const personas: ContractVerdict["personas"] = [];
  // Each persona block looks like: {"persona":"...","verdict":"...","reasoning":"...","confidence":N}
  // We iterate over all "persona": occurrences and try to parse a minimal window around each.
  const personaPattern = /"persona"\s*:\s*"([^"]+)"/g;
  let personaMatch: RegExpExecArray | null;
  while ((personaMatch = personaPattern.exec(raw)) !== null) {
    const start = raw.lastIndexOf("{", personaMatch.index);
    // Grab a window large enough to cover a single persona entry (~500 chars)
    const window = raw.slice(start, start + 600);

    const verdictM = window.match(/"verdict"\s*:\s*"([^"]+)"/);
    const reasoningM = window.match(/"reasoning"\s*:\s*"([^"]+)"/);
    const confidenceM = window.match(/"confidence"\s*:\s*(\d+(?:\.\d+)?)/);

    personas.push({
      persona: personaMatch[1],
      verdict: verdictM?.[1] ?? "",
      reasoning: reasoningM?.[1] ?? "",
      confidence: confidenceM ? parseFloat(confidenceM[1]) : 0,
    });
  }

  // ── supreme (optional) ───────────────────────────────────────────────────
  let supreme: ContractVerdict["supreme"] | undefined;
  const supremeBlockMatch = raw.match(/"supreme"\s*:\s*\{([^}]*)\}/);
  if (supremeBlockMatch) {
    const sb = supremeBlockMatch[1];
    const sPersona = sb.match(/"persona"\s*:\s*"([^"]+)"/)?.[1];
    const sVerdict = sb.match(/"verdict"\s*:\s*"([^"]+)"/)?.[1];
    const sReasoning = sb.match(/"reasoning"\s*:\s*"([^"]+)"/)?.[1];
    if (sPersona) {
      supreme = { persona: sPersona, verdict: sVerdict ?? "", reasoning: sReasoning ?? "" };
    }
  }

  const verdict: ContractVerdict = { defendant, outcome, appealed, personas, xp_delta: xpDelta, supreme };
  console.log(`[contract] regex extraction succeeded: outcome=${outcome}, personas=${personas.length}`);
  return verdict;
}

export async function createMatchOnContract(
  playerAddresses: string[],
): Promise<number> {
  const client = getClient();
  const address = getAddress();

  const hash = await client.writeContract({
    address,
    functionName: "create_match",
    args: [JSON.stringify(playerAddresses)],
    value: 0n,
  });

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    interval: 3000,
    retries: 60,
  });

  const r = receipt as any;
  console.log(`[contract] create_match r.result: ${JSON.stringify(r.result)}`);
  console.log(`[contract] create_match r.decoded_data: ${JSON.stringify(r.decoded_data)}`);

  const leaderResult = r.consensus_data?.leader_receipt?.[0]?.result;
  console.log(`[contract] create_match leader_receipt[0].result: ${JSON.stringify(leaderResult)?.slice(0, 500)}`);

  let matchId: number | undefined;

  // ── 1. decoded_data (clean path) ─────────────────────────────────────────
  if (typeof r.decoded_data === "number") {
    matchId = r.decoded_data;
  } else if (r.decoded_data && typeof r.decoded_data === "object" && typeof r.decoded_data.match_id === "number") {
    matchId = r.decoded_data.match_id;
  }

  // ── 2. consensus_data leader receipt ────────────────────────────────────
  if (matchId === undefined && leaderResult?.status === "return") {
    const raw = leaderResult?.payload?.readable;
    console.log(`[contract] create_match raw payload: ${JSON.stringify(raw)?.slice(0, 500)}`);

    if (raw !== undefined && raw !== null) {
      const parsed = extractFromRaw(raw);

      if (typeof parsed === "number") {
        matchId = parsed;
      } else if (parsed && typeof parsed === "object" && typeof parsed.match_id === "number") {
        matchId = parsed.match_id;
      } else {
        // parsed === null means JSON.parse failed (malformed) — use regex
        const m = String(raw).match(/"match_id"\s*:\s*(\d+)/);
        if (m) {
          matchId = parseInt(m[1], 10);
          console.log(`[contract] create_match extracted match_id via regex: ${matchId}`);
        }
      }
    }
  }

  if (matchId === undefined) {
    throw new Error(
      `create_match tx finalized but cannot extract match_id. ` +
      `leader result: ${JSON.stringify(leaderResult)?.slice(0, 300)}`
    );
  }

  console.log(`[contract] create_match returned match_id=${matchId}`);
  return matchId;
}

export async function submitRoundToContract(params: {
  matchId: number;
  roundNumber: number;
  chargeText: string;
  defendantAddress: string;
  accusationsJson: string;
  defenseText: string;
}): Promise<ContractVerdict> {
  const client = getClient();
  const address = getAddress();

  const hash = await client.writeContract({
    address,
    functionName: "submit_round",
    args: [
      params.matchId,
      params.roundNumber,
      params.chargeText,
      params.defendantAddress,
      params.accusationsJson,
      params.defenseText,
    ],
    value: 0n,
  });

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    interval: 3000,
    retries: 60,
  });

  const r = receipt as any;
  console.log(`[contract] submit_round r.result: ${JSON.stringify(r.result)?.slice(0, 200)}`);
  console.log(`[contract] submit_round r.decoded_data: ${JSON.stringify(r.decoded_data)?.slice(0, 200)}`);
  console.log(`[contract] submit_round r.status_name: ${r.status_name}`);

  const leaderResult = r.consensus_data?.leader_receipt?.[0]?.result;
  console.log(`[contract] submit_round leader_receipt[0].result: ${JSON.stringify(leaderResult)?.slice(0, 500)}`);

  let result: ContractVerdict | undefined;

  // ── 1. decoded_data (clean path) ─────────────────────────────────────────
  if (r.decoded_data && typeof r.decoded_data === "object") {
    result = r.decoded_data as ContractVerdict;
    console.log(`[contract] submit_round result from decoded_data`);
  }

  // ── 2. consensus_data leader receipt ────────────────────────────────────
  if (!result && leaderResult?.status === "return") {
    const raw = leaderResult?.payload?.readable;
    console.log(`[contract] submit_round raw payload: ${JSON.stringify(raw)?.slice(0, 500)}`);

    if (raw !== undefined && raw !== null) {
      const parsed = extractFromRaw(raw);

      if (parsed && typeof parsed === "object") {
        // Clean JSON parse succeeded
        result = parsed as ContractVerdict;
        console.log(`[contract] submit_round result from clean JSON parse`);
      } else if (parsed === null) {
        // Malformed JSON — extract field-by-field via regex
        const extracted = extractVerdictFromMalformedJson(String(raw));
        if (extracted) {
          result = extracted;
        } else {
          console.error(`[contract] submit_round regex extraction failed for payload: ${String(raw).slice(0, 300)}`);
        }
      }
    }
  }

  if (!result) {
    console.error(`[contract] submit_round receipt keys:`, Object.keys(r));
    console.error(`[contract] consensus_data keys:`, Object.keys(r.consensus_data ?? {}));
    throw new Error(
      `submit_round tx finalized but no result in receipt. ` +
      `Status: ${r.status_name ?? r.status}`
    );
  }

  return result;
}

export async function appealRoundOnContract(params: {
  matchId: number;
  roundNumber: number;
}): Promise<ContractVerdict> {
  const client = getClient();
  const address = getAddress();

  const hash = await client.writeContract({
    address,
    functionName: "appeal_round",
    args: [params.matchId, params.roundNumber],
    value: 0n,
  });

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    interval: 3000,
    retries: 60,
  });

  const r = receipt as any;
  const leaderResult = r.consensus_data?.leader_receipt?.[0]?.result;

  let result: ContractVerdict | undefined;

  // ── 1. decoded_data (clean path) ─────────────────────────────────────────
  if (r.decoded_data && typeof r.decoded_data === "object") {
    result = r.decoded_data as ContractVerdict;
  }

  // ── 2. consensus_data leader receipt ────────────────────────────────────
  if (!result && leaderResult?.status === "return") {
    const raw = leaderResult?.payload?.readable;
    if (raw !== undefined && raw !== null) {
      const parsed = extractFromRaw(raw);

      if (parsed && typeof parsed === "object") {
        result = parsed as ContractVerdict;
      } else if (parsed === null) {
        // Malformed JSON fallback
        const extracted = extractVerdictFromMalformedJson(String(raw));
        if (extracted) result = extracted;
      }
    }
  }

  if (!result) {
    throw new Error(`appeal_round tx finalized but no result in receipt`);
  }

  return result;
}

export async function readFromContract(
  functionName: string,
  args: Array<string | number | boolean | bigint> = [],
): Promise<unknown> {
  const client = getClient();
  const address = getAddress();
  return await client.readContract({ address, functionName, args });
}

export function isContractConfigured(): boolean {
  return !!process.env.CONTRACT_ADDRESS;
}