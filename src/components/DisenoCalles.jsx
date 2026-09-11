import { useState, Fragment } from 'react';
import { Polygon, Polyline, CircleMarker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { paralela, ajustarAngulo, metrosEntre } from '../utils/disenoGeo';

/* Capa de calles del modo Diseño.

   Una calle son DOS bordes independientes. Se traza el borde A siguiendo el
   límite visible de la manzana en el satélite —que es una línea real, a
   diferencia del eje, que hay que adivinar— y el borde B nace como paralela al
   ancho indicado. Pero el ancho es solo el arranque: después cada borde se mueve
   por su cuenta, porque una calle de verdad se abre y se cierra.

   Dos ayudas al trazar:
   - Imán a vértices de calles ya dibujadas (14 px), para que la malla cierre.
   - Imán de ángulo a múltiplos de 90° respecto al segmento anterior, que es
     donde se gana precisión sin pelear con el pulso. */

const SNAP_PX = 14;

const bordesDe = (c) => [c.A || [], c.B || []];

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

export default function DisenoCalles({
  calles = [], visible = true,
  dibujando, trazo, setTrazo, onTerminar,
  borrador, seleccionId, onSeleccionar, onMedida,
}) {
  const [raton, setRaton] = useState(null);

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
      const { punto } = resolver(map, e.latlng);
      setTrazo([...trazo, punto]);
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

  return (
    <>
      {calles.map(c => {
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
              eventHandlers={{ click: (e) => { if (!dibujando) { L.DomEvent.stop(e); onSeleccionar(c.id); } } }}
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
    </>
  );
}
