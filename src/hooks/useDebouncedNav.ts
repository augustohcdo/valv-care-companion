import { useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Returns a click handler that debounces rapid taps.
 * Navigates to `to` and ignores duplicate taps within `delay` ms.
 * Also calls `onBefore` (e.g. close a menu) before navigating.
 */
export function useDebouncedNav(delay = 300) {
  const navigate = useNavigate();
  const lastTap = useRef(0);

  const go = useCallback(
    (to: string, onBefore?: () => void) => (e: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastTap.current < delay) {
        e.preventDefault();
        return;
      }
      lastTap.current = now;
      e.preventDefault();
      onBefore?.();
      navigate(to);
    },
    [delay, navigate],
  );

  return go;
}
