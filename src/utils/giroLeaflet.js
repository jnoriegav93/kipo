// ── EL GIRO, ENSEÑADO POR DENTRO DE LEAFLET ───────────────────────────────────
// Leaflet da por sentado que el norte está arriba. El primer intento lo corrigió
// DESDE AFUERA —interceptando gestos y apagándole sus manejadores— y salió mal: el
// giro iba entrecortado, el zoom saltaba y en iPhone el navegador se quedaba con el
// gesto, porque sin sus manejadores Leaflet deja de poner `touch-action: none`.
//
// Aquí se hace al revés: se le enseña el ángulo a él. Sus manejadores siguen
// encendidos y por lo tanto su arrastre con inercia, su pellizco suave y su
// `touch-action` siguen siendo suyos. Solo se tocan dos piezas:
//
//   1. `mouseEventToContainerPoint`, que es el EMBUDO por el que pasan el clic, el
//      toque y los dos dedos del pellizco. Corregido ahí, el foco del zoom deja de
//      saltar solo, sin tocar el zoom.
//   2. El desplazamiento del arrastre, que viene en píxeles de pantalla y hay que
//      girarlo a la referencia del mapa. Se corrige enganchándose a `predrag`, el
//      aviso que Leaflet lanza justo antes de aplicar la posición, en vez de copiar
//      su código. De paso se deshace su corrección de escala: la mide con el
//      rectángulo en pantalla, y la caja que envuelve a algo torcido es más grande.
//
// Se parchea la INSTANCIA del mapa, no el prototipo: el mapa del modo Diseño no se
// entera de nada.
import L from 'leaflet';
import { desgirarPunto } from './giroMapa.js';

const coordsDelEvento = (e) => {
  if (!e) return null;
  if (typeof e.clientX === 'number') return { x: e.clientX, y: e.clientY };
  const t = e.touches?.[0] || e.changedTouches?.[0];
  return t ? { x: t.clientX, y: t.clientY } : null;
};

// `leerGiro` es una función para que el parche vea SIEMPRE el ángulo del momento,
// sin tener que reinstalarse en cada cambio.
export const instalarGiro = (map, leerGiro) => {
  if (!map || typeof leerGiro !== 'function') return () => {};

  // ── 1. De dónde cayó el dedo ────────────────────────────────────────────────
  const originalPunto = map.mouseEventToContainerPoint;
  map.mouseEventToContainerPoint = function (e) {
    const giro = leerGiro() || 0;
    if (!giro) return originalPunto.call(this, e);
    const coords = coordsDelEvento(e);
    if (!coords) return originalPunto.call(this, e);

    const cont = this.getContainer();
    const caja = cont.getBoundingClientRect();
    // El CENTRO sí es fiable con el mapa girado; la esquina no, porque el navegador
    // informa la caja que lo envuelve. De ahí se reconstruye la esquina verdadera
    // con el tamaño de maquetación.
    const centro = { x: caja.left + caja.width / 2, y: caja.top + caja.height / 2 };
    const derecho = desgirarPunto(coords, centro, giro);
    return L.point(
      derecho.x - (centro.x - cont.offsetWidth / 2),
      derecho.y - (centro.y - cont.offsetHeight / 2),
    );
  };

  // ── 2. Hacia dónde arrastró el dedo ─────────────────────────────────────────
  const arrastre = map.dragging && map.dragging._draggable;
  const alPreArrastre = () => {
    const giro = leerGiro() || 0;
    if (!giro || !arrastre?._newPos || !arrastre?._startPos) return;
    const corrido = arrastre._newPos.subtract(arrastre._startPos);
    const escala = arrastre._parentScale || { x: 1, y: 1 };
    // Se deshace la escala (miente con el mapa girado) y se gira el desplazamiento
    const real = { x: corrido.x * (escala.x || 1), y: corrido.y * (escala.y || 1) };
    const enElMapa = desgirarPunto(real, { x: 0, y: 0 }, giro);
    arrastre._newPos = arrastre._startPos.add(L.point(enElMapa.x, enElMapa.y));
  };
  if (arrastre) arrastre.on('predrag', alPreArrastre);

  return () => {
    map.mouseEventToContainerPoint = originalPunto;
    if (arrastre) arrastre.off('predrag', alPreArrastre);
  };
};
