import type {
  Accusation,
  Defense,
  PersonaVerdict,
  PlayerId,
  Verdict,
  VerdictOutcome,
} from "@backstab/shared";
import { BASE_XP_STAKE } from "@backstab/shared";

/**
 * STUB jury. Replaced in Phase 2 by a contract call that runs
 * prompt_comparative over a single LLM prompt simulating all 5 personas.
 *
 * Shape matches the real contract return so the UI layer never changes.
 */

const PERSONAS = [
  "Stern Judge",
  "Drunk Poet",
  "Conspiracy Theorist",
  "Corporate HR",
  "Literal Toddler",
];

const FLAVOR: Record<string, string[]> = {
  "Stern Judge": [
    "The prosecution has presented facts. The defense dodges.",
    "I've seen enough courtroom theatrics for one lifetime.",
    "Guilt is the null hypothesis until proven otherwise.",
  ],
  "Drunk Poet": [
    "Truth wears many cloaks tonight, and all of them are wet.",
    "The defendant's eyes tell a softer story than their words.",
    "Life is a tavern and we are all behind on rent.",
  ],
  "Conspiracy Theorist": [
    "Notice who WASN'T accused. That's the real defendant.",
    "The accusations align too perfectly. Follow the money.",
    "The pigeons know. They always know.",
  ],
  "Corporate HR": [
    "This behavior violates several unwritten policies.",
    "I'll need everyone to complete a sensitivity module.",
    "Flagging this for a 1:1 review next quarter.",
  ],
  "Literal Toddler": [
    "Why is everyone YELLING.",
    "Defendant said a funny word. I like them.",
    "I want juice.",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function decideOutcome(accusations: Accusation[], defense: Defense | null): VerdictOutcome {
  // Pseudo-logic so the stub feels lively without real intelligence:
  // - No defense submitted → lean GUILTY
  // - 0 accusations → INNOCENT
  // - Otherwise coin flip with 20% CHAOTIC chance
  if (accusations.length === 0) return "INNOCENT";
  if (!defense || !defense.text.trim()) return "GUILTY";
  const r = Math.random();
  if (r < 0.2) return "CHAOTIC";
  return r < 0.55 ? "GUILTY" : "INNOCENT";
}

export function runStubJury(
  defendantId: PlayerId,
  accusations: Accusation[],
  defense: Defense | null,
  opts: { doubleStake?: boolean } = {},
): Verdict {
  const personas: PersonaVerdict[] = PERSONAS.map((persona) => {
    const r = Math.random();
    const verdict: VerdictOutcome =
      r < 0.15 ? "CHAOTIC" : r < 0.55 ? "GUILTY" : "INNOCENT";
    return {
      persona,
      verdict,
      reasoning: pick(FLAVOR[persona]),
      confidence: 1 + Math.floor(Math.random() * 10),
    };
  });

  // Majority among personas (CHAOTIC counted separately).
  const counts: Record<VerdictOutcome, number> = { GUILTY: 0, INNOCENT: 0, CHAOTIC: 0 };
  for (const p of personas) counts[p.verdict] += 1;

  // Blend stub-decided outcome with persona tally: if personas split < 3-vote
  // lead, call it an Appeal (bump to CHAOTIC-flavored appeal).
  const top = (Object.entries(counts) as Array<[VerdictOutcome, number]>)
    .sort((a, b) => b[1] - a[1])[0];
  const margin = top[1] - (counts.GUILTY + counts.INNOCENT + counts.CHAOTIC - top[1]);
  const appealed = margin <= 1;

  const outcome: VerdictOutcome = appealed
    ? decideOutcome(accusations, defense)
    : top[0];

  // XP math: defendant gains on INNOCENT, loses on GUILTY.
  // Prosecutors mirror the swing split across them. CHAOTIC = small gain to defendant.
  const stake = (opts.doubleStake ? 2 : 1) * BASE_XP_STAKE;
  const xpDelta: Record<PlayerId, number> = {};
  const accusers = accusations.map((a) => a.accuser);

  if (outcome === "GUILTY") {
    xpDelta[defendantId] = -stake;
    const perAccuser = accusers.length > 0 ? Math.max(1, Math.floor(stake / accusers.length)) : 0;
    for (const a of accusers) xpDelta[a] = (xpDelta[a] ?? 0) + perAccuser;
  } else if (outcome === "INNOCENT") {
    xpDelta[defendantId] = stake;
    const perAccuser = accusers.length > 0 ? -Math.max(1, Math.floor(stake / accusers.length)) : 0;
    for (const a of accusers) xpDelta[a] = (xpDelta[a] ?? 0) + perAccuser;
  } else {
    xpDelta[defendantId] = Math.floor(stake / 2);
    for (const a of accusers) xpDelta[a] = 1;
  }

  return {
    defendant: defendantId,
    outcome,
    appealed,
    personas,
    xpDelta,
  };
}
