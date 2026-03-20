import { useEffect, useState } from "react";

export function useRefetchCountdown(
  enabled: boolean,
  intervalMs: number,
  resetAtMs: number,
) {
  const intervalSeconds = Math.ceil(intervalMs / 1000);
  const [secondsLeft, setSecondsLeft] = useState(intervalSeconds);

  useEffect(() => {
    if (!enabled) {
      setSecondsLeft(intervalSeconds);
      return;
    }

    const update = () => {
      const elapsed = Math.max(0, Date.now() - resetAtMs);
      const remainder = elapsed % intervalMs;
      const remainingMs = remainder === 0 ? intervalMs : intervalMs - remainder;
      setSecondsLeft(Math.max(1, Math.ceil(remainingMs / 1000)));
    };

    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, intervalSeconds, resetAtMs]);

  return secondsLeft;
}
