import { useState, Fragment } from 'react';
import { Polygon, Polyline, CircleMarker, Marker, Pane, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { paralela, ajustarAngulo, metrosEntre, proyectarEnPolilinea, anchoLocal } from '../utils/disenoGeo';

/* Capa de calles del modo Diseño.

   Una calle son DOS bordes independientes. Se traza el borde A siguiendo el
   límite visible de la manzana en el satélite —que es una línea real, a
   diferencia del eje, que hay que adivinar— y el borde B nace como paralela al
   ancho indicado. Pero el ancho es solo el arranque: después cada borde se mueve
   por su cuenta, porque una calle de verdad se abre y se cierra.

   Dos ayudas al trazar:
   - Imán a vértices de calles ya dibujadas (14 px), para que la malla cierre.
   - Imán de ángulo a múltiplos de 90° respecto al segmento anterior, que es
     donde se gana precisión sin pelear con el pulso.

   Al editar, la calle se dibuja aparte con un tirador en cada vértice de los dos
   bordes. Mientras se arrastra se ve el ancho local contra el borde de enfrente,
   y el vértice se imanta a vértices (16 px) o a bordes (12 px) de otras calles.
   Según el modo que elija el panel, los bordes aceptan además un clic para
   agregar vértice o para cortar. */

/* Con el dedo no se apunta tan fino como con el ratón: en pantallas táctiles los imanes
   alcanzan más lejos y los tiradores son más grandes (24/09). */
const TACTIL = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)')?.matches;
const ESCALA_TOQUE = TACTIL ? 1.7 : 1;
const SNAP_PX = Math.round(14 * ESCALA_TOQUE);
const SNAP_EDICION_VERTICE_PX = Math.round(16 * ESCALA_TOQUE);
const SNAP_EDICION_BORDE_PX = Math.round(12 * ESCALA_TOQUE);
const FRANJA_BORDE_PX = TACTIL ? 30 : 18;
const COLOR_EDICION = '#FACC15';

const bordesDe = (c) => [c.A || [], c.B || []];

/* Tirador de vértice. Es una constante a propósito: si el icono cambiara en cada
   render, react-leaflet lo reemplazaría en pleno arrastre y lo cortaría. */
const TIRADOR_PX = TACTIL ? 36 : 22;   // área que se puede tocar
const PUNTO_PX = TACTIL ? 17 : 13;     // lo que se ve
const ICONO_VERTICE = L.divIcon({
  className: 'diseno-vertice',
  html: `<div style="width:${TIRADOR_PX}px;height:${TIRADOR_PX}px;display:flex;align-items:center;justify-content:center;cursor:move">
    <div style="width:${PUNTO_PX}px;height:${PUNTO_PX}px;border-radius:50%;background:${COLOR_EDICION};border:2.5px solid #0F1217;box-shadow:0 0 6px rgba(0,0,0,.6)"></div></div>`,
  iconSize: [TIRADOR_PX, TIRADOR_PX],
  iconAnchor: [TIRADOR_PX / 2, TIRADOR_PX / 2],
});

const iconoMedida = (texto, color) => L.divIcon({
  className: '',
  html: `<div style="transform:translate(-50%,-170%);white-space:nowrap;font:800 11px system-ui;color:${color};
    background:rgba(15,18,23,.92);border:1px solid #3A4250;border-radius:6px;padding:2px 7px;">${texto}</div>`,
  iconSize: [0, 0],
});

/* Vértice de otra calle más cercano al cursor, dentro del umbral en píxeles. */
const imanVertice = (map, latlng, calles, trazo) => {
  const raton = map.latLngToContainerPoint(latlng);
  let mejor = null, dMin = SNAP_PX;
  const candidatos = [];
  calles.forEach(c => bordesDe(c).forEach(b => candidatos.push(...b)));
  trazo.forEach(p => candidatos.push(p));
  for (const p of candidatos) {
    const q = map.latLngToContainerPoint(p);
    const d = Math.hypot(raton.x - q.x, raton.y - q.y);
    if (d < dMin) { dMin = d; mejor = p; }
  }
  return mejor;
};

/* Imán de un vértice en edición: primero vértices —de las otras calles y de la
   propia, menos el que se mueve— y si no hay ninguno cerca, los bordes de las
   otras calles. */
const imanEdicion = (map, punto, calles, edicion, borde, idx) => {
  const raton = map.latLngToContainerPoint(punto);
  const distPx = (p) => { const q = map.latLngToContainerPoint(p); return Math.hypot(raton.x - q.x, raton.y - q.y); };
  const otras = calles.filter(c => String(c.id) !== String(edicion.id));

  const candidatos = [];
  otras.forEach(c => bordesDe(c).forEach(b => candidatos.push(...b)));
  ['A', 'B'].forEach(k => edicion[k].forEach((p, i) => { if (k !== borde || i !== idx) candidatos.push(p); }));
  let mejor = null, dMin = SNAP_EDICION_VERTICE_PX;
  for (const p of candidatos) {
    const d = distPx(p);
    if (d < dMin) { dMin = d; mejor = p; }
  }
  if (mejor) return { punto: [...mejor], imantado: 'vertice' };

  let enBorde = null;
  dMin = SNAP_EDICION_BORDE_PX;
  otras.forEach(c => bordesDe(c).forEach(b => {
    const pr = proyectarEnPolilinea(b, punto);
    if (!pr) return;
    const d = distPx(pr.punto);
    if (d < dMin) { dMin = d; enBorde = pr.punto; }
  }));
  if (enBorde) return { punto: enBorde, imantado: 'borde' };

  return { punto, imantado: null };
};

export default function DisenoCalles({
  calles = [], visible = true,
  dibujando, trazo, setTrazo, onTerminar,
  borrador, seleccionId, onSeleccionar, onMedida,
  edicion, onMoverVertice, onClicBorde,
}) {
  const [raton, setRaton] = useState(null);
  const [arrastre, setArrastre] = useState(null);   // { borde, idx, punto, imantado } mientras se arrastra

  /* Resuelve dónde cae realmente un punto: primero el imán a vértices, y si no,
     el imán de ángulo respecto al segmento anterior. */
  const resolver = (map, latlng) => {
    const v = imanVertice(map, latlng, calles, trazo);
    if (v) return { punto: [...v], imantado: 'vertice' };
    if (trazo.length >= 2) {
      const { punto, imantado } = ajustarAngulo(trazo[trazo.length - 2], trazo[trazo.length - 1], [latlng.lat, latlng.lng]);
      if (imantado) return { punto, imantado: 'angulo' };
    }
    return { punto: [latlng.lat, latlng.lng], imantado: null };
  };

  const map = useMapEvents({
    click(e) {
      if (!dibujando) return;
      const { punto, imantado } = resolver(map, e.latlng);
      setTrazo([...trazo, punto]);
      // Con el dedo no hay "pasar por encima": el largo se ve al tocar, el del tramo puesto
      if (trazo.length > 0) onMedida?.({ largo: metrosEntre(trazo[trazo.length - 1], punto), imantado });
    },
    dblclick(e) {
      if (!dibujando || trazo.length < 2) return;
      L.DomEvent.stop(e);
      onTerminar();
    },
    mousemove(e) {
      if (!dibujando || trazo.length === 0) return;
      const { punto, imantado } = resolver(map, e.latlng);
      setRaton({ punto, imantado });
      onMedida?.({
        largo: metrosEntre(trazo[trazo.length - 1], punto),
        imantado,
      });
    },
  });

  if (!visible) return null;

  const previa = dibujando && trazo.length > 0
    ? (raton ? [...trazo, raton.punto] : trazo)
    : null;

  // El borrador muestra ya los dos bordes, para elegir lado y ancho viéndolo
  const bordeB = borrador ? paralela(borrador.A, borrador.ancho, borrador.lado) : null;

  // Bordes de la calle en edición, con el vértice que se arrastra ya en su sitio
  const vivo = (borde) => (arrastre && arrastre.borde === borde
    ? edicion[borde].map((p, i) => (i === arrastre.idx ? arrastre.punto : p))
    : edicion[borde]);
  const bordesClicables = edicion && (edicion.modo === 'agregar' || edicion.modo === 'cortar');

  return (
    <>
      {calles.map(c => {
        if (edicion && String(c.id) === String(edicion.id)) return null; // la dibuja el editor
        const [A, B] = bordesDe(c);
        if (A.length < 2 || B.length < 2) return null;
        const sel = String(c.id) === String(seleccionId);
        const anillo = [...A, ...[...B].reverse()];
        return (
          <Fragment key={c.id}>
            <Polygon
              positions={anillo}
              pathOptions={{
                color: sel ? '#FF6600' : '#38BDF8',
                weight: sel ? 2 : 1,
                fillColor: sel ? '#FF6600' : '#38BDF8',
                fillOpacity: sel ? 0.22 : 0.1,
              }}
              eventHandlers={{ click: (e) => { if (!dibujando && !edicion) { L.DomEvent.stop(e); onSeleccionar(c.id); } } }}
            />
            <Polyline positions={A} pathOptions={{ color: sel ? '#FF6600' : '#7DD3FC', weight: 2.5 }} />
            <Polyline positions={B} pathOptions={{ color: sel ? '#FF6600' : '#7DD3FC', weight: 2.5, dashArray: '5 4' }} />
          </Fragment>
        );
      })}

      {borrador && bordeB && (
        <>
          <Polygon
            positions={[...borrador.A, ...[...bordeB].reverse()]}
            pathOptions={{ color: '#FF6600', weight: 1.5, fillColor: '#FF6600', fillOpacity: 0.18, dashArray: '6 4' }}
          />
          <Polyline positions={borrador.A} pathOptions={{ color: '#FF6600', weight: 3 }} />
          <Polyline positions={bordeB} pathOptions={{ color: '#FF6600', weight: 2, dashArray: '6 4' }} />
        </>
      )}

      {previa && previa.length >= 2 && (
        <Polyline positions={previa} pathOptions={{ color: '#FF6600', weight: 3, dashArray: '6 4' }} />
      )}

      {dibujando && trazo.map((p, i) => (
        <CircleMarker key={i} center={p} radius={4}
          pathOptions={{ color: '#0F1217', weight: 2, fillColor: '#FF6600', fillOpacity: 1 }} />
      ))}

      {/* El punto del cursor cambia de color cuando algún imán lo está sujetando */}
      {dibujando && raton && raton.imantado && (
        <CircleMarker center={raton.punto} radius={6}
          pathOptions={{
            color: raton.imantado === 'vertice' ? '#22c55e' : '#FACC15',
            weight: 3, fillOpacity: 0,
          }} />
      )}

      {/* Calle en edición, en su propio panel por encima de las manzanas: comparten
          lado con la calle y, si no, se quedarían con los clics sobre el borde. */}
      <Pane name="diseno-edicion" style={{ zIndex: 450 }}>
        {edicion && (
          <>
            <Polygon
              positions={[...vivo('A'), ...[...vivo('B')].reverse()]}
              interactive={false}
              pathOptions={{ stroke: false, fillColor: COLOR_EDICION, fillOpacity: 0.16 }}
            />
            {['A', 'B'].map(borde => (
              <Fragment key={borde}>
                <Polyline positions={vivo(borde)} interactive={false}
                  pathOptions={{ color: COLOR_EDICION, weight: 3, dashArray: borde === 'B' ? '5 4' : null }} />
                {bordesClicables && (
                  // Franja invisible y ancha sobre el borde: acertarle a una línea de 3 px cansa
                  <Polyline
                    positions={vivo(borde)}
                    pathOptions={{ color: COLOR_EDICION, weight: FRANJA_BORDE_PX, opacity: 0 }}
                    eventHandlers={{ click: (e) => { L.DomEvent.stop(e); onClicBorde(borde, [e.latlng.lat, e.latlng.lng]); } }}
                  />
                )}
              </Fragment>
            ))}
            {edicion.corte && (
              <CircleMarker center={edicion.corte.punto} radius={8} interactive={false}
                pathOptions={{ color: '#EF4444', weight: 3, fillColor: '#EF4444', fillOpacity: 0.45 }} />
            )}
          </>
        )}
      </Pane>

      {/* Tiradores. `position` es el mismo par del estado, sin copiarlo: si llegara
          uno nuevo en cada render, react-leaflet movería el marcador en pleno
          arrastre y lo devolvería a su sitio. */}
      {edicion && ['A', 'B'].map(borde => edicion[borde].map((p, i) => (
        <Marker
          key={`${borde}-${i}`}
          position={p}
          draggable
          icon={ICONO_VERTICE}
          eventHandlers={{
            drag: (e) => {
              const ll = e.target.getLatLng();
              const r = imanEdicion(map, [ll.lat, ll.lng], calles, edicion, borde, i);
              if (r.imantado) e.target.setLatLng(r.punto);
              setArrastre({ borde, idx: i, ...r });
            },
            dragend: (e) => {
              const ll = e.target.getLatLng();
              const r = imanEdicion(map, [ll.lat, ll.lng], calles, edicion, borde, i);
              setArrastre(null);
              onMoverVertice(borde, i, r.punto);
            },
          }}
        />
      )))}

      {/* Ancho local mientras se arrastra, medido contra el borde de enfrente */}
      {edicion && arrastre && (
        <Marker
          position={arrastre.punto}
          interactive={false}
          icon={iconoMedida(
            `${(anchoLocal(edicion[arrastre.borde === 'A' ? 'B' : 'A'], arrastre.punto) ?? 0).toFixed(1)} m`,
            arrastre.imantado ? '#22c55e' : '#E7EAEF',
          )}
        />
      )}
    </>
  );
}
