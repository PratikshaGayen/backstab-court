import type { Charge } from "@backstab/shared";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHARGES_PATH = resolve(__dirname, "../../../contract/content/charges.json");

/** How many charges to use per week (subset of the full pool). */
const WEEKLY_POOL_SIZE = 15;

let fullPool: string[] | null = null;
let weeklyPool: string[] | null = null;
let weekKey: string | null = null;

function loadFull(): string[] {
  if (fullPool) return fullPool;
  try {
    const raw = readFileSync(CHARGES_PATH, "utf-8");
    fullPool = JSON.parse(raw) as string[];
  } catch {
    fullPool = [
      "teaching pigeons to gamble",
      "being the reason Mondays exist",
      "selling fake NFTs to your grandmother",
    ];
  }
  return fullPool;
}

/**
 * Get the current ISO week key (e.g. "2026-W20").
 * Used to rotate the charge subset weekly.
 */
function currentWeekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Deterministic shuffle based on a seed string.
 * Same week = same subset, so all rooms in a week see the same charges.
 */
function seededShuffle(arr: string[], seed: string): string[] {
  const copy = [...arr];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  // Simple LCG seeded by the hash
  let state = Math.abs(hash) || 1;
  const next = () => {
    state = (state * 1664525 + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getWeeklyPool(): string[] {
  const wk = currentWeekKey();
  if (weeklyPool && weekKey === wk) return weeklyPool;

  const full = loadFull();
  const shuffled = seededShuffle(full, wk);
  weeklyPool = shuffled.slice(0, Math.min(WEEKLY_POOL_SIZE, full.length));
  weekKey = wk;
  console.log(`[charges] Rotated to week ${wk}: ${weeklyPool.length} charges active`);
  return weeklyPool;
}

const usedByRoom = new Map<string, Set<number>>();  // FIXED: #11

export function resetMatchCharges(roomId: string): void {  // FIXED: #11
  usedByRoom.set(roomId, new Set());                       // FIXED: #11
}                                                          // FIXED: #11

export function disposeRoomCharges(roomId: string): void { // FIXED: #11
  usedByRoom.delete(roomId);                               // FIXED: #11
}                                                          // FIXED: #11

export function getCharge(roomId: string): Charge {        // FIXED: #11
  const pool = getWeeklyPool();
  let used = usedByRoom.get(roomId);                                     // FIXED: #11
  if (!used) { used = new Set(); usedByRoom.set(roomId, used); }         // FIXED: #11

  const available = pool                                                 // FIXED: #11
    .map((text, idx) => ({ text, idx }))                                 // FIXED: #11
    .filter(({ idx }) => !used!.has(idx));                               // FIXED: #11

  const pick = available.length > 0                                      // FIXED: #11
    ? available[Math.floor(Math.random() * available.length)]            // FIXED: #11
    : { text: pool[Math.floor(Math.random() * pool.length)], idx: -1 };  // FIXED: #11

  if (pick.idx >= 0) used.add(pick.idx);                                 // FIXED: #11
  return { id: pick.idx, text: pick.text };
}

export function getWeeklyChargeList(): string[] {
  return getWeeklyPool();
}
