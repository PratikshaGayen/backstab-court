import { useState } from "react";

export default function DefenseInput({
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
        <p className="muted">Defense submitted. The jury deliberates next.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>Defend the take</h3>
      <p className="small muted">
        Why is this hot take RIGHT? Convince the jury. Be sharp, be bold.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 300))}
        rows={3}
        placeholder="This is absolutely correct because..."
        style={{ width: "100%", padding: 12, fontSize: 15 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <span className="small muted">{text.length}/300</span>
        <button disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>
          Submit defense
        </button>
      </div>
    </div>
  );
}
