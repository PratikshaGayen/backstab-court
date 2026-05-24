import type { PlayerId } from "@backstab/shared";

/**
 * Bot personalities — each bot has a name and a style that affects
 * how they write accusations and defenses.
 */
interface BotPersonality {
  displayName: string;
  style: "aggressive" | "dramatic" | "silly" | "formal" | "paranoid";
}

const BOT_POOL: BotPersonality[] = [
  { displayName: "AgentChaos", style: "aggressive" },
  { displayName: "DramaLlama", style: "dramatic" },
  { displayName: "SirGoofington", style: "silly" },
  { displayName: "JudgeBot3000", style: "formal" },
  { displayName: "TinfoilTed", style: "paranoid" },
  { displayName: "VibeCheck", style: "silly" },
  { displayName: "ColdLogic", style: "formal" },
  { displayName: "MayorMischief", style: "aggressive" },
];

const ACCUSATIONS: Record<BotPersonality["style"], string[]> = {
  aggressive: [
    "This is the worst take I've ever heard. Zero logic, pure delusion.",
    "Anyone who believes this hasn't thought about it for more than 5 seconds.",
    "The data literally proves the opposite. This take is indefensible.",
    "I can't believe someone would say this with a straight face.",
    "This is contrarian for the sake of being contrarian. No substance.",
  ],
  dramatic: [
    "This take wounds the very fabric of rational discourse.",
    "I weep for anyone who genuinely holds this position.",
    "History will not be kind to those who defended this view.",
    "The audacity of this claim is matched only by its wrongness.",
    "If this take were a ship, it would have sunk before leaving port.",
  ],
  silly: [
    "My goldfish has better takes than this and he can't even read.",
    "I showed this to my cat and she walked away in disgust.",
    "This take is so cold it lowered the room temperature.",
    "Even autocorrect would refuse to type this opinion.",
    "I've seen better arguments on the back of a cereal box.",
  ],
  formal: [
    "The empirical evidence overwhelmingly contradicts this position.",
    "This argument fails to account for several well-documented counterexamples.",
    "A rigorous analysis reveals fundamental flaws in this reasoning.",
    "The logical framework underpinning this claim is demonstrably unsound.",
    "Peer-reviewed research consistently refutes this perspective.",
  ],
  paranoid: [
    "This take only benefits the people at the top. Think about who gains.",
    "They WANT you to believe this. It's manufactured consensus.",
    "Follow the money and you'll see why this take exists.",
    "This is propaganda disguised as an opinion. Don't fall for it.",
    "The real question is: who planted this idea and why?",
  ],
};

const DEFENSES: Record<BotPersonality["style"], string[]> = {
  aggressive: [
    "You're all wrong and deep down you know it. The truth hurts.",
    "Name one solid counterargument. You can't. Because this is correct.",
    "Everyone disagreeing is just uncomfortable with the truth.",
    "The backlash proves my point. People hate hearing what's real.",
    "Come back with actual evidence instead of emotional reactions.",
  ],
  dramatic: [
    "I stand by this truth even as the world turns against me.",
    "Sometimes the most important truths are the hardest to accept.",
    "History remembers those who spoke uncomfortable truths. I am that person today.",
    "The beauty of this take is that time will prove me right.",
    "I hold this position not because it's popular, but because it's honest.",
  ],
  silly: [
    "I'm right and I have vibes to prove it. Vibes don't lie.",
    "My gut feeling has a 73% accuracy rate on hot takes. Trust the gut.",
    "I asked my houseplant and it nodded. That's peer review.",
    "This take passed the shower thought test. It hits different at 2am.",
    "If this take were a song it would be a banger. Case closed.",
  ],
  formal: [
    "The underlying data supports this position when examined objectively.",
    "Multiple longitudinal studies corroborate this perspective.",
    "The logical consistency of this argument withstands scrutiny.",
    "I invite critics to engage with the substance rather than the framing.",
    "This position is well-supported by established research in the field.",
  ],
  paranoid: [
    "The people attacking this take are the ones who benefit from the status quo.",
    "Notice how nobody can actually disprove it - they just get emotional.",
    "This is suppressed knowledge. They don't want you to agree with me.",
    "The coordinated pushback proves this take is over the target.",
    "I'm being attacked because I'm right. That's how you know.",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let botCounter = 0;

export function createBotId(): PlayerId {
  return `bot_${++botCounter}_${Date.now().toString(36)}`;
}

export function pickBotPersonality(usedNames: Set<string>): BotPersonality {
  const available = BOT_POOL.filter((b) => !usedNames.has(b.displayName));
  return available.length > 0 ? pick(available) : pick(BOT_POOL);
}

export function getBotAccusation(style: BotPersonality["style"]): string {
  return pick(ACCUSATIONS[style]);
}

export function getBotDefense(style: BotPersonality["style"]): string {
  return pick(DEFENSES[style]);
}

export interface BotInfo {
  id: PlayerId;
  personality: BotPersonality;
}
