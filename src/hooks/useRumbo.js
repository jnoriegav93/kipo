import { useCallback, useEffect, useRef, useState } from 'react';
import { rumboDesdeEvento, suavizarRumbo, cambioNotorio, necesitaPermisoBrujula } from '../utils/rumbo';

// ── BRÚJULA DEL TELÉFONO ──────────────────────────────────────────────────────
// Devuelve hacia dónde está mirando el equipo, para el cono del punto azul.
//
//   estado 'permiso'     → iPhone: hay que tocar un botón para habilitarla
//   estado 'esperando'   → suscrito, pero todavía no llegó ninguna lectura
//   estado 'activo'      → hay rumbo
//   estado 'negado'      → el usuario dijo que no
//   estado 'sin-brujula' → el equipo no la tiene, o no manda lecturas absolutas
//
// No escribe nada ni toca la red: solo escucha al sensor. El estado se DEDUCE en
// el render (no se fija dentro del efecto, que dispara renders en cascada).

const anguloDePantalla = () => {
  const a = window.screen?.orientation?.angle;
  if (typeof a === 'number') return a;
  return typeof window.orientation === 'number' ? window.orientation : 0;
};

// Si en este tiempo no llegó una lectura útil, se da por hecho que no hay brújula:
// hay equipos que aceptan la suscripción y nunca informan nada absoluto.
const ESPERA_MS = 4000;

export const useRumbo = (activo = true) => {
  const [rumbo, setRumbo] = useState(null);
  const [permisoPedido, setPermisoPedido] = useState(false);
  const [permisoNegado, setPermisoNegado] = useState(false);
  const [sinLecturas, setSinLecturas] = useState(false);
  const rumboRef = useRef(null);    // valor suavizado, sin pasar por el render
  const mostradoRef = useRef(null); // último valor que se llegó a pintar

  const haySensor = typeof window !== 'undefined' && !!window.DeviceOrientationEvent;
  // El permiso solo se pide en equipos táctiles: en una PC con mouse no hay brújula
  // que habilitar y el aviso sería puro ruido en el mapa.
  const esTactil = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)')?.matches;
  const esperaPermiso = haySensor && esTactil && necesitaPermisoBrujula(window) && !permisoPedido;

  const estado = !haySensor ? 'sin-brujula'
    : permisoNegado ? 'negado'
      : esperaPermiso ? 'permiso'
        : rumbo != null ? 'activo'
          : sinLecturas ? 'sin-brujula'
            : 'esperando';

  // iPhone: pedir permiso exige un gesto del usuario, así que esto lo llama un botón.
  const pedirPermiso = useCallback(async () => {
    try {
      const respuesta = await window.DeviceOrientationEvent.requestPermission();
      if (respuesta === 'granted') setPermisoPedido(true);
      else setPermisoNegado(true);
    } catch {
      setPermisoNegado(true);
    }
  }, []);

  useEffect(() => {
    if (!activo || !haySensor || esperaPermiso || permisoNegado) return;

    const alLeer = (evento) => {
      const crudo = rumboDesdeEvento(evento, anguloDePantalla());
      if (crudo == null) return;                    // lectura sin norte: no sirve
      const suave = suavizarRumbo(rumboRef.current, crudo);
      rumboRef.current = suave;
      // Se compara contra lo que se está MOSTRANDO, no contra el valor interno: así
      // los pasos chicos se van acumulando y el cono no queda corrido. Y cuando el
      // suavizado ya alcanzó la lectura real, se pinta ese valor exacto.
      const estable = suave === crudo;
      if (estable ? mostradoRef.current !== suave : cambioNotorio(mostradoRef.current, suave)) {
        mostradoRef.current = suave;
        setRumbo(suave);
      }
    };

    // 'deviceorientationabsolute' es el que promete rumbo real; donde no exista,
    // 'deviceorientation' a secas (en iPhone trae webkitCompassHeading).
    window.addEventListener('deviceorientationabsolute', alLeer, true);
    window.addEventListener('deviceorientation', alLeer, true);
    const t = setTimeout(() => { if (rumboRef.current == null) setSinLecturas(true); }, ESPERA_MS);

    return () => {
      clearTimeout(t);
      window.removeEventListener('deviceorientationabsolute', alLeer, true);
      window.removeEventListener('deviceorientation', alLeer, true);
    };
  }, [activo, haySensor, esperaPermiso, permisoNegado]);

  return { rumbo, estado, pedirPermiso };
};

export default useRumbo;
