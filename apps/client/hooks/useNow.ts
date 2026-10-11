import { useEffect, useState } from 'react';

/**
 * The current local time in ms, re-read every `intervalMs` while `active`.
 * Drives countdown displays; pass `active: false` when nothing is counting so
 * a hotseat game (or an online one with timers off) runs no interval at all.
 */
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    // Catch up immediately: `now` may be stale from when the clock last ran.
    const tick = () => setNow(Date.now());
    const timeout = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(timeout);
      clearInterval(id);
    };
  }, [active, intervalMs]);
  return now;
}
