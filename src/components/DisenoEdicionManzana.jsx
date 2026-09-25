import { Fragment, useEffect, useRef, useState } from 'react';
import { CircleMarker, Pane, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useArrastreLejos } from '../hooks/useArrastreMapa';
import { buscarIman } from '../utils/disenoIman';

/* Vértices y lados de la manzana elegida (25/09, pedido del usuario para el celular).

   Se toca un vértice y queda marcado; después, un dedo en CUALQUIER parte del mapa lo
   mueve lo mismo que el dedo, así el dedo no tapa el punto. Con dos dedos el mapa se
   sigue moviendo. En las rectangulares también se marca un lado, que se mueve paralelo
   a sí mismo: la cuadra sigue recta. El vértice movido se imanta a las otras manzanas.

   Mientras dura el arrastre, la forma nueva va por `onArrastre` (la vista la dibuja con
   sus casas); al soltar, por `onSoltar`, o `onSoltar(null)` si se canceló.

   La franja para tocar un lado va POR FUERA de la manzana, sobre la calle: adentro se
   tocan las casas. Centrada en el lado, con el dedo tapaba casas enteras (25/09). */

const TACTIL = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)')?.matches;
const RADIO_TOQUE = TACTIL ? 16 : 10;   // alrededor del vértice, para acertarle con el dedo
const FRANJA_LADO = TACTIL ? 26 : 14;   // de ancho, afuera del lado
const COLOR = '#FF6600';

// ¿Está el punto (en píxeles) dentro del polígono (en píxeles)?
const adentro = (p, poli) => {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const a = poli[i], b = poli[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
};

/* La franja de cada lado corrida hacia afuera: de 1 px adentro a FRANJA_LADO px afuera,
   calculada en pantalla para que mida lo mismo con cualquier zoom. */
const franjasAfuera = (map, pts) => {
  const px = pts.map(p => map.latLngToContainerPoint(p));
  const aLatLng = (x, y) => { const ll = map.containerPointToLatLng([x, y]); return [ll.lat, ll.lng]; };
  return px.map((a, i) => {
    const b = px[(i + 1) % px.length];
    const ex = b.x - a.x, ey = b.y - a.y;
    const largo = Math.hypot(ex, ey) || 1;
    let nx = -ey / largo, ny = ex / largo;
    const medio = { x: (a.x + b.x) / 2 + nx * 2, y: (a.y + b.y) / 2 + ny * 2 };
    if (adentro(medio, px)) { nx = -nx; ny = -ny; }
    const d = FRANJA_LADO / 2 - 1;
    return [aLatLng(a.x + nx * d, a.y + ny * d), aLatLng(b.x + nx * d, b.y + ny * d)];
  });
};

export default function DisenoEdicionManzana({ manzana, forma, marcado, onMarcar, conLados, manzanas, onArrastre, onSoltar }) {
  const map = useMap();
  const inicio = useRef(null); // posición en pantalla de cada vértice al empezar a arrastrar
  // La franja de los lados se mide en píxeles: se rehace al cambiar el zoom
  const [, setZoom] = useState(0);
  useEffect(() => {
    if (!map.on) return undefined;
    const alZoom = () => setZoom(z => z + 1);
    map.on('zoomend', alZoom);
    return () => map.off('zoomend', alZoom);
  }, [map]);

  const moverA = ({ dx, dy }) => {
    const px = inicio.current;
    if (!px || !marcado) return manzana.latlngs;
    const aLatLng = (x, y) => { const ll = map.containerPointToLatLng([x, y]); return [ll.lat, ll.lng]; };
    if (marcado.tipo === 'vertice') {
      const i = marcado.i;
      const libre = aLatLng(px[i].x + dx, px[i].y + dy);
      const p = buscarIman(map, libre, manzanas, manzana.id) || libre;
      return manzana.latlngs.map((q, k) => (k === i ? p : q));
    }
    // Lado i (de i a i + 1): los dos extremos se corren lo mismo, perpendicular al lado
    const i = marcado.i, j = (i + 1) % px.length;
    const ex = px[j].x - px[i].x, ey = px[j].y - px[i].y;
    const largo = Math.hypot(ex, ey) || 1;
    const nx = -ey / largo, ny = ex / largo;
    const d = dx * nx + dy * ny;
    return manzana.latlngs.map((q, k) => (k === i || k === j ? aLatLng(px[k].x + nx * d, px[k].y + ny * d) : q));
  };

  useArrastreLejos(map, !!marcado, {
    alEmpezar: () => { inicio.current = manzana.latlngs.map(p => map.latLngToContainerPoint(p)); },
    alMover: (d) => onArrastre(moverA(d)),
    alSoltar: (d) => { onSoltar(d ? moverA(d) : null); inicio.current = null; },
  });

  const pts = forma || manzana.latlngs;
  const n = pts.length;
  const franjas = conLados ? franjasAfuera(map, pts) : [];
  const alternar = (m) => (e) => {
    L.DomEvent.stop(e);
    onMarcar(marcado && marcado.tipo === m.tipo && marcado.i === m.i ? null : m);
  };

  return (
    <Pane name="diseno-manzana-edicion" style={{ zIndex: 460 }}>
      {conLados && pts.map((p, i) => {
        const q = pts[(i + 1) % n];
        const esEste = marcado?.tipo === 'lado' && marcado.i === i;
        return (
          <Fragment key={`lado-${i}`}>
            {esEste && <Polyline positions={[p, q]} interactive={false} pathOptions={{ color: COLOR, weight: 5 }} />}
            {/* Franja invisible y ancha, afuera del lado: acertarle a una línea fina cansa */}
            <Polyline positions={franjas[i]}
              pathOptions={{ color: COLOR, weight: FRANJA_LADO, opacity: 0, lineCap: 'butt', className: 'toque-lado' }}
              eventHandlers={{ click: alternar({ tipo: 'lado', i }) }} />
          </Fragment>
        );
      })}
      {pts.map((p, i) => {
        const esEste = marcado?.tipo === 'vertice' && marcado.i === i;
        return (
          <Fragment key={`vertice-${i}`}>
            <CircleMarker center={p} radius={esEste ? 8 : 5} interactive={false}
              pathOptions={{ color: '#0F1217', weight: 2, fillColor: esEste ? COLOR : '#FFFFFF', fillOpacity: 1 }} />
            <CircleMarker center={p} radius={RADIO_TOQUE}
              pathOptions={{ stroke: false, fillColor: '#FFFFFF', fillOpacity: 0.001, className: 'toque-vertice' }}
              eventHandlers={{ click: alternar({ tipo: 'vertice', i }) }} />
          </Fragment>
        );
      })}
    </Pane>
  );
}
