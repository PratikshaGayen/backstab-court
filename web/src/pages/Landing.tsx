import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getDisplayName, setDisplayName } from "../lib/identity";

export default function Landing() {
  const navigate = useNavigate();
  const [name, setName] = useState(() => getDisplayName());

  const go = () => {
    setDisplayName(name);
    navigate("/lobby");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim()) go();
  };

  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="landing-logo">🔪</div>
        <h1 className="landing-title">Backstab Court</h1>
        <p className="landing-tagline">
          The AI is the judge. The jury is unhinged. Your friends are the witnesses.
        </p>
      </div>

      <div className="landing-card">
        <label className="landing-label">Choose your courtroom name</label>
        <div className="landing-input-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKey}
            maxLength={24}
            placeholder="SlyBadger42"
            className="landing-input"
          />
          <button onClick={go} disabled={!name.trim()} className="btn-primary btn-lg">
            Play
          </button>
        </div>
      </div>

      <div className="landing-how">
        <h3>How it works</h3>
        <div className="how-steps">
          <div className="how-step">
            <span className="how-num">1</span>
            <span>Get accused of an absurd crime</span>
          </div>
          <div className="how-step">
            <span className="how-num">2</span>
            <span>Prosecutors write accusations, defendant defends</span>
          </div>
          <div className="how-step">
            <span className="how-num">3</span>
            <span>5 AI personas deliberate live and deliver a verdict</span>
          </div>
          <div className="how-step">
            <span className="how-num">4</span>
            <span>XP changes hands. Highest XP after 4 rounds wins</span>
          </div>
        </div>
      </div>

      <div className="landing-meta">
        <span>4-6 players</span>
        <span className="dot">-</span>
        <span>~10 minutes</span>
        <span className="dot">-</span>
        <span>Powered by <a href="https://genlayer.com" target="_blank" rel="noopener">GenLayer</a></span>
      </div>

      <div className="landing-footer">
        <Link to="/leaderboard">Global leaderboard</Link>
      </div>
    </div>
  );
}
