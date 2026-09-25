/* Imán de las manzanas del modo Diseño: un vértice se pega al de una manzana ya
   dibujada y, si no hay ninguno cerca, a uno de sus lados, para que las cuadras vecinas
   compartan lado y no queden rendijas. Sirve al dibujar y al mover vértices (25/09).

   Sin Leaflet: el mapa convierte por su cuenta los pares [lat, lng] y [x, y]. */

// Con el dedo el imán alcanza más lejos (24/09), igual que en las calles
const TACTIL = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)')?.matches;
const ESCALA_TOQUE = TACTIL ? 1.7 : 1;
export const SNAP_VERTICE_PX = Math.round(14 * ESCALA_TOQUE);
export const SNAP_ARISTA_PX  = Math.round(20 * ESCALA_TOQUE);

/* El punto imantado más cercano a `latlng` ([lat, lng] o {lat, lng}), primero entre los
   vértices y luego sobre las aristas; null si no hay nada a tiro. `excluirId` deja
   afuera a la manzana que se está editando. */
export const buscarIman = (map, latlng, manzanas, excluirId = null) => {
  const raton = map.latLngToContainerPoint(latlng);
  let mejorV = null, dV = SNAP_VERTICE_PX;
  let mejorA = null, dA = SNAP_ARISTA_PX;

  for (const m of manzanas) {
    if (excluirId != null && String(m.id) === String(excluirId)) continue;
    const pts = m.latlngs || [];
    const n = pts.length;
    if (n < 2) continue;
    const px = pts.map(p => map.latLngToContainerPoint(p));

    px.forEach((q, i) => {
      const d = Math.hypot(raton.x - q.x, raton.y - q.y);
      if (d < dV) { dV = d; mejorV = pts[i]; }
    });

    for (let i = 0; i < n; i++) {
      const a = px[i], b = px[(i + 1) % n];
      const dx = b.x - a.x, dy = b.y - a.y;
      const largoSq = dx * dx + dy * dy;
      if (largoSq < 1) continue;
      const t = Math.max(0, Math.min(1, ((raton.x - a.x) * dx + (raton.y - a.y) * dy) / largoSq));
      const cx = a.x + t * dx, cy = a.y + t * dy;
      const d = Math.hypot(raton.x - cx, raton.y - cy);
      if (d < dA) {
        dA = d;
        const ll = map.containerPointToLatLng([cx, cy]);
        mejorA = [ll.lat, ll.lng];
      }
    }
  }
  return mejorV || mejorA || null;
};
