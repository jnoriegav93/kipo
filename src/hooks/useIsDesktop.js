import { useState, useEffect } from 'react';

// Detecta "PC" = dispositivo con mouse/puntero fino y hover (no táctil).
// Un celular o tablet táctil nunca lo activa.
// Se exporta porque hay código que necesita la misma respuesta FUERA de React
// (el recorte de la caché de teselas), y dos copias del literal se separarían.
export const CONSULTA_PC = '(hover: hover) and (pointer: fine)';
export const esPC = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.(CONSULTA_PC).matches;

const QUERY = CONSULTA_PC;

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
