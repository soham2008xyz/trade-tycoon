import { useCallback, useRef, useState } from 'react';

/**
 * Guards create/join/start/action requests against double-submission (a
 * fast double-tap, or a tap registering twice on some platforms) firing
 * two POSTs for what the user intended as one action. Every request in the
 * online flow shares the one guard, so a second tap is dropped even when it
 * lands on a different button. The ref is the synchronous guard (state
 * updates are async, so a double-tap could slip between them); `busy`
 * mirrors it as state purely so buttons can render disabled while a request
 * is pending.
 */
export function useRequestGuard() {
  const requestInFlightRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (request: () => Promise<void>) => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setBusy(true);
    try {
      await request();
    } finally {
      requestInFlightRef.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
