import { useState, useEffect } from 'react';

// Detecta "PC" = dispositivo con mouse/puntero fino y hover (no táctil).
// Un celular o tablet táctil nunca lo activa.
const QUERY = '(hover: hover) and (pointer: fine)';

export default function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  return isDesktop;
}
