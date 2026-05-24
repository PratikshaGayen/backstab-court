import { useState } from "react";

export default function AccusationInput({
  onSubmit,
  submitted,
}: {
  onSubmit: (text: string) => void;
  submitted: boolean;
}) {
  const [text, setText] = useState("");

  if (submitted) {
    return (
      <div className="panel">
        <p className="muted">Your argument is in. Waiting on others.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>Your counter-argument</h3>
      <p className="small muted">Why is this hot take WRONG? Be persuasive - the AI jury is watching.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 240))}
        rows={3}
        placeholder="This take is wrong because..."
        style={{ width: "100%", padding: 12, fontSize: 15 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <span className="small muted">{text.length}/240</span>
        <button disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>
          Submit
        </button>
      </div>
    </div>
  );
}
