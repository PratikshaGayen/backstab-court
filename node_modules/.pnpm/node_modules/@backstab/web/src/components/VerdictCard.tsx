import { useRef, useCallback } from "react";
import type { Player, Verdict } from "@backstab/shared";

/**
 * Shareable verdict card — renders a verdict as a downloadable image.
 * Uses a hidden canvas to draw the card, then exports as PNG.
 */
export default function VerdictCard({
  verdict,
  players,
  round,
  charge,
}: {
  verdict: Verdict;
  players: Player[];
  round: number;
  charge: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 600;
    const H = 400;
    canvas.width = W;
    canvas.height = H;

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#1a1a24");
    grad.addColorStop(1, "#0e0e12");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Border accent
    const borderColor =
      verdict.outcome === "GUILTY" ? "#e53935" :
      verdict.outcome === "INNOCENT" ? "#4caf50" : "#f5c542";
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    // Title
    ctx.fillStyle = "#e9e9f0";
    ctx.font = "bold 24px Inter, system-ui, sans-serif";
    ctx.fillText("Backstab Court", 24, 40);

    // Round + charge
    ctx.fillStyle = "#8a8a99";
    ctx.font = "14px Inter, system-ui, sans-serif";
    ctx.fillText(`Round ${round}`, 24, 65);

    ctx.fillStyle = "#e9e9f0";
    ctx.font = "16px Inter, system-ui, sans-serif";
    const chargeText = charge.length > 55 ? charge.slice(0, 52) + "..." : charge;
    ctx.fillText(chargeText, 24, 90);

    // Defendant
    const defendant = players.find((p) => p.id === verdict.defendant);
    ctx.fillStyle = "#8a8a99";
    ctx.font = "13px Inter, system-ui, sans-serif";
    ctx.fillText("DEFENDANT", 24, 125);
    ctx.fillStyle = "#e9e9f0";
    ctx.font = "bold 18px Inter, system-ui, sans-serif";
    ctx.fillText(defendant?.displayName ?? "Unknown", 24, 148);

    // Verdict
    ctx.fillStyle = borderColor;
    ctx.font = "bold 36px Inter, system-ui, sans-serif";
    ctx.fillText(verdict.outcome, 24, 200);

    if (verdict.appealed) {
      ctx.fillStyle = "#f5c542";
      ctx.font = "bold 14px Inter, system-ui, sans-serif";
      ctx.fillText("APPEALED", 24 + ctx.measureText(verdict.outcome).width + 16, 200);
    }

    // Persona votes
    ctx.fillStyle = "#8a8a99";
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.fillText("JURY VOTES", 24, 235);

    verdict.personas.forEach((p, i) => {
      const y = 255 + i * 22;
      const vColor =
        p.verdict === "GUILTY" ? "#e53935" :
        p.verdict === "INNOCENT" ? "#4caf50" : "#f5c542";

      ctx.fillStyle = "#8a8a99";
      ctx.font = "13px Inter, system-ui, sans-serif";
      ctx.fillText(p.persona, 24, y);

      ctx.fillStyle = vColor;
      ctx.font = "bold 13px Inter, system-ui, sans-serif";
      ctx.fillText(p.verdict, 200, y);

      ctx.fillStyle = "#666";
      ctx.font = "12px Inter, system-ui, sans-serif";
      const reason = p.reasoning.length > 40 ? p.reasoning.slice(0, 37) + "..." : p.reasoning;
      ctx.fillText(reason, 280, y);
    });

    // Footer
    ctx.fillStyle = "#555";
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.fillText("Powered by GenLayer Optimistic Democracy", 24, H - 16);
    ctx.fillText("backstab.court", W - 100, H - 16);

    // Download
    const link = document.createElement("a");
    link.download = `backstab-court-round${round}-${verdict.outcome.toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [verdict, players, round, charge]);

  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={generateImage} className="ghost" style={{ fontSize: 13 }}>
        📸 Share verdict card
      </button>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
