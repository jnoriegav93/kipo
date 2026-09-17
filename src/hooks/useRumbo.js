import { useCallback, useEffect, useRef, useState } from 'react';
import { rumboDesdeEvento, suavizarRumbo, cambioNotorio, necesitaPermisoBrujula } from '../utils/rumbo';

// ── BRÚJULA DEL TELÉFONO ──────────────────────────────────────────────────────
// Devuelve hacia dónde está mirando el equipo, para el cono del punto azul.
//
//   estado 'esperando'   → escuchando, todavía sin lecturas
//   estado 'activo'      → hay rumbo
//   estado 'permiso'     → no llegó nada y el sistema sabe pedir permiso (iPhone)
//   estado 'negado'      → el usuario dijo que no
//   estado 'sin-brujula' → el equipo no la tiene, o no manda lecturas absolutas
//
// Se ESCUCHA PRIMERO y se pregunta después. Preguntar de entrada estaba mal: Android
// informa sin pedir nada, pero Chrome expone `requestPermission` igual, así que el
// aviso salía también ahí. Ahora el botón solo aparece si pasa el plazo sin una sola
// lectura y el sistema sabe pedir permiso.
//
// No escribe nada ni toca la red: solo escucha al sensor. El estado se DEDUCE en el
// render (nada de `setState` dentro del efecto, que dispara renders en cascada).

const anguloDePantalla = () => {
  const a = window.screen?.orientation?.angle;
  if (typeof a === 'number') return a;
  return typeof window.orientation === 'number' ? window.orientation : 0;
};

// Plazo sin lecturas tras el cual se ofrece el permiso (o se da por hecho que no hay
// brújula). Corto, para que en iPhone el botón no se haga esperar.
const ESPERA_MS = 2500;

export const useRumbo = (activo = true) => {
  const [rumbo, setRumbo] = useState(null);
  const [permisoPedido, setPermisoPedido] = useState(false);
  const [permisoNegado, setPermisoNegado] = useState(false);
  const [sinLecturas, setSinLecturas] = useState(false);
  const rumboRef = useRef(null);    // valor suavizado, sin pasar por el render
  const mostradoRef = useRef(null); // último valor que se llegó a pintar

  const haySensor = typeof window !== 'undefined' && !!window.DeviceOrientationEvent;
  // El permiso solo se ofrece en equipos táctiles: en una PC con mouse no hay brújula
  // que habilitar y el aviso sería puro ruido en el mapa.
  const esTactil = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)')?.matches;
  const puedePedirPermiso = haySensor && esTactil && necesitaPermisoBrujula(window);
  const esperaPermiso = puedePedirPermiso && !permisoPedido && sinLecturas && rumbo == null;

  const estado = !haySensor ? 'sin-brujula'
    : permisoNegado ? 'negado'
      : rumbo != null ? 'activo'
        : esperaPermiso ? 'permiso'
          : sinLecturas ? 'sin-brujula'
            : 'esperando';

  // iPhone: pedir permiso exige un gesto del usuario, así que esto lo llama un botón.
  const pedirPermiso = useCallback(async () => {
    try {
      const respuesta = await window.DeviceOrientationEvent.requestPermission();
      if (respuesta === 'granted') {
        setSinLecturas(false);   // arranca de nuevo el plazo
        setPermisoPedido(true);  // y vuelve a suscribirse: iOS no revive las viejas
      } else {
        setPermisoNegado(true);
      }
    } catch {
      setPermisoNegado(true);
    }
  }, []);

  useEffect(() => {
    if (!activo || !haySensor || permisoNegado) return;

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
  }, [activo, haySensor, permisoNegado, permisoPedido]);

  return { rumbo, estado, pedirPermiso };
};

export default useRumbo;
