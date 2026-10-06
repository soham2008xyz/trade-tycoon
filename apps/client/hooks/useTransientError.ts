import { useCallback, useEffect, useRef, useState } from 'react';

/** Server/lobby error text that clears itself after three seconds. */
export function useTransientError() {
  const [error, setError] = useState<string | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Centralized helper so a 200ms transient toast doesn't accumulate timers. */
  const setTransientError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setError(null);
      errorTimeoutRef.current = null;
    }, 3000);
  }, []);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  return { error, setTransientError };
}
