import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { localnet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RPC = process.env.GENLAYER_RPC_URL || "http://localhost:4000/api";
const contractPath = resolve("contract/backstab_court.py");

async function main() {
  const code = readFileSync(contractPath, "utf-8");
  console.log(`Contract size: ${code.length} chars, has CR: ${code.includes("\r")}, non-ASCII: ${(code.match(/[^\x00-\x7F]/g) || []).length}`);

  const pk = generatePrivateKey();
  const account = createAccount(pk);
  console.log(`Deployer: ${account.address}`);

  const client = createClient({ chain: localnet, endpoint: RPC, account });
  const orig = client.request;
  client.request = async (args) => {
    if (args.method === "eth_gasPrice") return (await orig(args)) ?? "0x1";
    return orig(args);
  };

  console.log("Deploying...");
  const hash = await client.deployContract({ code, args: [], value: 0n });
  console.log(`TX hash: ${hash}`);

  console.log("Waiting for finalization...");
  const receipt = await client.waitForTransactionReceipt({
    hash, status: TransactionStatus.FINALIZED, interval: 3000, retries: 60,
  });

  // Extract contract address from receipt
  const r = receipt;
  const contractAddress = r?.data?.contract_address || r?.contract_snapshot?.contract_address || r?.to_address;
  
  if (contractAddress) {
    console.log(`\n✅ CONTRACT DEPLOYED AT: ${contractAddress}`);
  } else {
    console.log("\nReceipt (looking for address):");
    console.log("  data.contract_address:", r?.data?.contract_address);
    console.log("  contract_snapshot.contract_address:", r?.contract_snapshot?.contract_address);
    console.log("  to_address:", r?.to_address);
  }
}

main().catch((e) => { console.error("Deploy failed:", e.message || e); process.exit(1); });
