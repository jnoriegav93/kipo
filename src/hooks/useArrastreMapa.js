import { useEffect, useRef } from 'react';

/* Gestos del modo Diseño sobre el mapa, pensados para el dedo (25/09).

   - useArrastreLejos: con algo marcado (un vértice, un lado), un dedo en CUALQUIER parte
     del mapa lo mueve lo mismo que el dedo. Así el dedo no tapa el punto que se ajusta.
     Mientras tanto el mapa no se arrastra con un dedo; con dos, sí (y hace zoom).
   - usePresionarYArrastrar: mantener presionado un instante y arrastrar dibuja en vivo
     hasta soltar. Un toque corto sigue siendo un toque, y un arrastre sin esperar sigue
     moviendo el mapa.

   Van con eventos de puntero sobre el contenedor de Leaflet. `touch-action: none` hace
   falta mientras dura el gesto: sin él, el navegador se queda con el dedo para su propio
   desplazamiento y corta el arrastre. */

const MOVIMIENTO_MIN_PX = 4;      // menos que esto es un toque, no un arrastre
const ESPERA_PRESION_MS = 350;    // mantener presionado para empezar a dibujar
const TOLERANCIA_PRESION_PX = 8;  // si el dedo se mueve más antes de eso, se mueve el mapa

const posicion = (cont, e) => {
  const r = cont.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

/* Tras un arrastre, el navegador puede mandar un clic al soltar: ese clic no es un toque.
   Se descarta UNO, y solo si llega enseguida; si no, el toque siguiente de la persona
   (marcar otro vértice, por ejemplo) se perdería. */
const DESCARTE_MS = 250;
const descartarClic = (cont) => {
  let quitar = null;
  const tragar = (e) => { e.stopPropagation(); e.preventDefault(); quitar(); };
  const t = setTimeout(() => quitar(), DESCARTE_MS);
  quitar = () => { clearTimeout(t); cont.removeEventListener('click', tragar, true); };
  cont.addEventListener('click', tragar, true);
};

// Los manejadores cambian en cada render; las escuchas se quedan con los últimos
const useUltimos = (manejadores) => {
  const ref = useRef(manejadores);
  useEffect(() => { ref.current = manejadores; });
  return ref;
};

/* alEmpezar() al pasar el umbral de movimiento; alMover({ dx, dy }) en píxeles desde
   donde bajó el dedo; alSoltar({ dx, dy }) al soltar, o alSoltar(null) si se canceló
   (bajó un segundo dedo: es un gesto del mapa). */
export const useArrastreLejos = (map, activo, manejadores) => {
  const ultimos = useUltimos(manejadores);
  useEffect(() => {
    if (!activo || !map?.getContainer) return undefined;
    const cont = map.getContainer();
    const touchAntes = cont.style.touchAction;
    cont.style.touchAction = 'none';
    const arrastraba = map.dragging?.enabled ? map.dragging.enabled() : true;
    map.dragging?.disable();

    const dedos = new Set();
    let id = null, inicio = null, moviendo = false;
    const delta = (e) => { const p = posicion(cont, e); return { dx: p.x - inicio.x, dy: p.y - inicio.y }; };
    const cancelar = () => {
      if (moviendo) ultimos.current.alSoltar?.(null);
      id = null; moviendo = false;
    };
    const abajo = (e) => {
      dedos.add(e.pointerId);
      if (dedos.size > 1) { cancelar(); return; }
      id = e.pointerId; inicio = posicion(cont, e); moviendo = false;
    };
    const mover = (e) => {
      if (e.pointerId !== id) return;
      const d = delta(e);
      if (!moviendo) {
        if (Math.hypot(d.dx, d.dy) < MOVIMIENTO_MIN_PX) return;
        moviendo = true;
        ultimos.current.alEmpezar?.();
      }
      ultimos.current.alMover?.(d);
    };
    const arriba = (e) => {
      dedos.delete(e.pointerId);
      if (e.pointerId !== id) return;
      if (moviendo) { descartarClic(cont); ultimos.current.alSoltar?.(delta(e)); }
      id = null; moviendo = false;
    };
    const cancelado = (e) => { dedos.delete(e.pointerId); if (e.pointerId === id) cancelar(); };

    cont.addEventListener('pointerdown', abajo);
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', arriba);
    window.addEventListener('pointercancel', cancelado);
    return () => {
      cont.removeEventListener('pointerdown', abajo);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', arriba);
      window.removeEventListener('pointercancel', cancelado);
      if (arrastraba) map.dragging?.enable();
      cont.style.touchAction = touchAntes;
    };
  }, [map, activo, ultimos]);
};

/* alEmpezar([lat, lng]) cuando se cumple la espera; alMover([lat, lng]) mientras se
   arrastra; alSoltar([lat, lng]) al soltar; alCancelar() si entra un segundo dedo. */
export const usePresionarYArrastrar = (map, activo, manejadores) => {
  const ultimos = useUltimos(manejadores);
  useEffect(() => {
    if (!activo || !map?.getContainer) return undefined;
    const cont = map.getContainer();
    const aLatLng = (p) => { const ll = map.containerPointToLatLng([p.x, p.y]); return [ll.lat, ll.lng]; };

    const dedos = new Set();
    let id = null, inicio = null, espera = null, arrastrando = false;
    const terminar = (ultimo) => {
      clearTimeout(espera); espera = null;
      if (arrastrando) {
        arrastrando = false;
        map.dragging?.enable();
        if (ultimo) { descartarClic(cont); ultimos.current.alSoltar?.(aLatLng(ultimo)); }
        else ultimos.current.alCancelar?.();
      }
      id = null;
    };
    const abajo = (e) => {
      dedos.add(e.pointerId);
      if (dedos.size > 1) { terminar(null); return; }
      id = e.pointerId; inicio = posicion(cont, e);
      espera = setTimeout(() => {
        espera = null; arrastrando = true;
        map.dragging?.disable();
        navigator.vibrate?.(15);
        ultimos.current.alEmpezar?.(aLatLng(inicio));
      }, ESPERA_PRESION_MS);
    };
    const mover = (e) => {
      if (e.pointerId !== id) return;
      const p = posicion(cont, e);
      if (!arrastrando) {
        // Se movió antes de la espera: es mover el mapa
        if (Math.hypot(p.x - inicio.x, p.y - inicio.y) > TOLERANCIA_PRESION_PX) { clearTimeout(espera); espera = null; id = null; }
        return;
      }
      ultimos.current.alMover?.(aLatLng(p));
    };
    const arriba = (e) => { dedos.delete(e.pointerId); if (e.pointerId === id) terminar(posicion(cont, e)); };
    const cancelado = (e) => { dedos.delete(e.pointerId); if (e.pointerId === id) terminar(null); };

    cont.addEventListener('pointerdown', abajo);
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', arriba);
    window.addEventListener('pointercancel', cancelado);
    return () => {
      terminar(null);
      cont.removeEventListener('pointerdown', abajo);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', arriba);
      window.removeEventListener('pointercancel', cancelado);
    };
  }, [map, activo, ultimos]);
};
