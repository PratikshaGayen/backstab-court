import { useEffect, useState } from "react";

export default function PhaseTimer({ endsAt }: { endsAt: number | null }) {
  const [remaining, setRemaining] = useState<number>(
    endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0,
  );

  useEffect(() => {
    if (!endsAt) {
      setRemaining(0);
      return;
    }
    setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    const i = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(i);
  }, [endsAt]);

  if (!endsAt) return null;
  return (
    <span className="timer">
      {remaining}s
    </span>
  );
}
