import type { PersonaVerdict } from "@backstab/shared";

const PERSONA_EMOJI: Record<string, string> = {
  "Stern Judge": "👨‍⚖️",
  "Drunk Poet": "🍷",
  "Conspiracy Theorist": "🕵️",
  "Corporate HR": "💼",
  "Literal Toddler": "🧒",
  "Supreme Validator": "👑",
};

const VERDICT_COLOR: Record<string, string> = {
  GUILTY: "#e53935",
  INNOCENT: "#4caf50",
  CHAOTIC: "#f5c542",
};

export default function JuryStream({ bubbles }: { bubbles: PersonaVerdict[] }) {
  return (
    <div className="panel">
      <h3>The jury deliberates</h3>
      {bubbles.length === 0 && (
        <div className="muted small">
          <p>The jury clears its collective throat...</p>
          <p style={{ fontSize: 11, opacity: 0.7 }}>
            ⏳ AI validators are deliberating via Optimistic Democracy consensus.
            This may take 30–60 seconds.
          </p>
        </div>
      )}
      <div className="bubbles">
        {bubbles.map((b, i) => (
          <div key={i} className="bubble">
            <div className="bubble-head">
              <span>{PERSONA_EMOJI[b.persona] ?? "⚖️"} {b.persona}</span>
              <span
                style={{
                  color: VERDICT_COLOR[b.verdict],
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {b.verdict}
              </span>
            </div>
            <div className="bubble-body">{b.reasoning}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
