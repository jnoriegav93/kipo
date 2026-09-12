import { useState } from 'react';
import { Polygon, Polyline, Circle, CircleMarker, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { rectangulo3Puntos } from '../utils/disenoGeo';

/* Capa de dibujo del catastro sobre el mapa del modo Diseño.

   Herramientas:
   - manzanaRect  Cuadra rectangular en tres clics (base y ancho). El ángulo recto
                  se calcula en píxeles de pantalla, no en grados: un rectángulo
                  "recto" en lat/lng se ve torcido a estas latitudes.
   - manzanaLibre Cuadra irregular, un clic por vértice.
   - areaPoly     Área especial poligonal.
   - areaCirc     Área especial circular: centro y luego el borde.
   - marcador     Un clic; el tipo se elige después.
   - etiqueta     Un clic; el texto se escribe después.

   Los vértices se imantan a las manzanas ya dibujadas para que las cuadras
   vecinas compartan lado y no queden rendijas entre ellas. */

const SNAP_VERTICE_PX = 14;
const SNAP_ARISTA_PX  = 20;

const ES_POLIGONO = { manzanaRect: true, manzanaLibre: true, areaPoly: true };

/* Busca el punto imantado más cercano: primero vértices, luego aristas. */
const buscarIman = (map, latlng, manzanas) => {
  const raton = map.latLngToContainerPoint(latlng);
  let mejorV = null, dV = SNAP_VERTICE_PX;
  let mejorA = null, dA = SNAP_ARISTA_PX;

  for (const m of manzanas) {
    const pts = m.latlngs || [];
    const n = pts.length;
    if (n < 2) continue;

    for (const p of pts) {
      const px = map.latLngToContainerPoint(L.latLng(p[0], p[1]));
      const d = Math.hypot(raton.x - px.x, raton.y - px.y);
      if (d < dV) { dV = d; mejorV = p; }
    }

    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const aPx = map.latLngToContainerPoint(L.latLng(a[0], a[1]));
      const bPx = map.latLngToContainerPoint(L.latLng(b[0], b[1]));
      const dx = bPx.x - aPx.x, dy = bPx.y - aPx.y;
      const largoSq = dx * dx + dy * dy;
      if (largoSq < 1) continue;
      const t = Math.max(0, Math.min(1, ((raton.x - aPx.x) * dx + (raton.y - aPx.y) * dy) / largoSq));
      const cx = aPx.x + t * dx, cy = aPx.y + t * dy;
      const d = Math.hypot(raton.x - cx, raton.y - cy);
      if (d < dA) {
        dA = d;
        const ll = map.containerPointToLatLng(L.point(cx, cy));
        mejorA = [ll.lat, ll.lng];
      }
    }
  }
  return mejorV || mejorA || null;
};

const metros = (a, b) => L.latLng(a[0], a[1]).distanceTo(L.latLng(b[0], b[1]));

const iconoEtiqueta = (texto) => L.divIcon({
  className: '',
  html: `<div style="transform:translate(-50%,-50%);white-space:nowrap;font:700 11px system-ui;
    color:#E7EAEF;background:rgba(15,18,23,.85);border:1px solid #3A4250;border-radius:6px;padding:2px 7px;">
    ${String(texto).replace(/[<>&]/g, '')}</div>`,
  iconSize: [0, 0],
});

export default function DisenoCatastro({
  manzanas = [], areas = [], marcadores = [], etiquetas = [],
  capas, herramienta, pts, setPts, onFinalizar,
  seleccion, onSeleccionar,
}) {
  const [raton, setRaton] = useState(null);

  const map = useMapEvents({
    click(e) {
      if (!herramienta) return;
      const bruto = [e.latlng.lat, e.latlng.lng];
      const p = ES_POLIGONO[herramienta] ? (buscarIman(map, e.latlng, manzanas) || bruto) : bruto;

      // Herramientas de un solo clic
      if (herramienta === 'marcador' || herramienta === 'etiqueta') {
        onFinalizar(herramienta, { latlng: p });
        return;
      }

      const nuevos = [...pts, p];

      if (herramienta === 'manzanaRect' && nuevos.length === 3) {
        onFinalizar('manzana', { latlngs: rectangulo3Puntos(map, nuevos[0], nuevos[1], nuevos[2]) });
        setPts([]); setRaton(null); return;
      }
      if (herramienta === 'areaCirc' && nuevos.length === 2) {
        onFinalizar('areaCirc', { center: nuevos[0], radius: metros(nuevos[0], nuevos[1]) });
        setPts([]); setRaton(null); return;
      }
      setPts(nuevos);
    },
    dblclick(e) {
      if ((herramienta !== 'manzanaLibre' && herramienta !== 'areaPoly') || pts.length < 3) return;
      L.DomEvent.stop(e);
      onFinalizar(herramienta === 'manzanaLibre' ? 'manzana' : 'areaPoly', { latlngs: pts });
      setPts([]); setRaton(null);
    },
    mousemove(e) {
      if (!herramienta || pts.length === 0) return;
      const bruto = [e.latlng.lat, e.latlng.lng];
      setRaton(ES_POLIGONO[herramienta] ? (buscarIman(map, e.latlng, manzanas) || bruto) : bruto);
    },
  });

  // Vista previa mientras se dibuja
  let previa = null;
  if (herramienta && pts.length > 0) {
    if (herramienta === 'manzanaRect' && pts.length === 2 && raton) {
      previa = <Polygon positions={rectangulo3Puntos(map, pts[0], pts[1], raton)}
        pathOptions={{ color: '#FF6600', weight: 2, fillOpacity: 0.15, dashArray: '6 4' }} />;
    } else if (herramienta === 'areaCirc' && pts.length === 1 && raton) {
      previa = <Circle center={pts[0]} radius={metros(pts[0], raton)}
        pathOptions={{ color: '#FF6600', weight: 2, fillOpacity: 0.15, dashArray: '6 4' }} />;
    } else {
      const linea = raton ? [...pts, raton] : pts;
      previa = linea.length >= 2
        ? <Polyline positions={linea} pathOptions={{ color: '#FF6600', weight: 2, dashArray: '6 4' }} />
        : null;
    }
  }

  const sel = (tipo, id) => seleccion && seleccion.tipo === tipo && String(seleccion.id) === String(id);
  const clic = (tipo, id) => ({
    click: (e) => { if (!herramienta) { L.DomEvent.stop(e); onSeleccionar({ tipo, id }); } },
  });

  return (
    <>
      {capas.manzanas && manzanas.map(m => (
        <Polygon
          key={m.id}
          positions={m.latlngs}
          pathOptions={{
            color: sel('manzana', m.id) ? '#FF6600' : '#E7EAEF',
            weight: sel('manzana', m.id) ? 3 : 1.6,
            fillColor: sel('manzana', m.id) ? '#FF6600' : '#E7EAEF',
            fillOpacity: sel('manzana', m.id) ? 0.22 : 0.08,
          }}
          eventHandlers={clic('manzana', m.id)}
        />
      ))}

      {capas.areas && areas.map(a => (
        a.tipo === 'circle'
          ? <Circle key={a.id} center={a.center} radius={a.radius}
              pathOptions={{ color: sel('area', a.id) ? '#FF6600' : '#38BDF8', weight: 2,
                fillColor: '#38BDF8', fillOpacity: sel('area', a.id) ? 0.28 : 0.15 }}
              eventHandlers={clic('area', a.id)} />
          : <Polygon key={a.id} positions={a.latlngs}
              pathOptions={{ color: sel('area', a.id) ? '#FF6600' : '#38BDF8', weight: 2,
                fillColor: '#38BDF8', fillOpacity: sel('area', a.id) ? 0.28 : 0.15 }}
              eventHandlers={clic('area', a.id)} />
      ))}

      {capas.marcadores && marcadores.map(m => (
        <CircleMarker key={m.id} center={m.latlng} radius={6}
          pathOptions={{ color: '#0F1217', weight: 2,
            fillColor: sel('marcador', m.id) ? '#FF6600' : '#FACC15', fillOpacity: 1 }}
          eventHandlers={clic('marcador', m.id)} />
      ))}

      {capas.etiquetas && etiquetas.map(t => (
        <Marker key={t.id} position={t.latlng} icon={iconoEtiqueta(t.texto)}
          eventHandlers={clic('etiqueta', t.id)} />
      ))}

      {previa}

      {/* Vértices ya puestos, para ver dónde se ancló el imán */}
      {herramienta && pts.map((p, i) => (
        <CircleMarker key={i} center={p} radius={4}
          pathOptions={{ color: '#0F1217', weight: 2, fillColor: '#FF6600', fillOpacity: 1 }} />
      ))}
    </>
  );
}
