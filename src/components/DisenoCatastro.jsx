import { useRef, useState } from 'react';
import { Polygon, Polyline, Circle, CircleMarker, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { rectangulo3Puntos } from '../utils/disenoGeo';
import { buscarIman } from '../utils/disenoIman';
import { useArrastreLejos, usePresionarYArrastrar } from '../hooks/useArrastreMapa';

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
   vecinas compartan lado y no queden rendijas entre ellas.

   Con el dedo (25/09):
   - En la cuadra rectangular, el 2.º y el 3.er punto también se ponen manteniendo
     presionado y arrastrando: la base o el rectángulo siguen al dedo hasta soltar.
   - Un punto ya puesto se toca y queda marcado; un dedo en cualquier parte del mapa lo
     mueve sin taparlo (ver hooks/useArrastreMapa.js). Tocar el mapa lo suelta. */

const TACTIL = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)')?.matches;
const RADIO_TOQUE = TACTIL ? 20 : 10;
const ES_POLIGONO = { manzanaRect: true, manzanaLibre: true, areaPoly: true };

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
  puntoMarcado = null, setPuntoMarcado = () => {}, onClicVacio, manzanaViva = null,
}) {
  const [raton, setRaton] = useState(null);
  const inicioPunto = useRef(null);

  const imantar = (ll) => {
    const bruto = Array.isArray(ll) ? ll : [ll.lat, ll.lng];
    return ES_POLIGONO[herramienta] ? (buscarIman(map, bruto, manzanas) || bruto) : bruto;
  };

  /* Pone el punto siguiente de la herramienta activa, venga de un toque o de soltar
     un arrastre. */
  const ponerPunto = (p) => {
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
  };

  const map = useMapEvents({
    click(e) {
      if (!herramienta) { onClicVacio?.(); return; }
      // Con un punto marcado, tocar el mapa lo suelta (no pone otro)
      if (puntoMarcado != null) { setPuntoMarcado(null); return; }
      ponerPunto(imantar(e.latlng));
    },
    dblclick(e) {
      if ((herramienta !== 'manzanaLibre' && herramienta !== 'areaPoly') || pts.length < 3) return;
      L.DomEvent.stop(e);
      onFinalizar(herramienta === 'manzanaLibre' ? 'manzana' : 'areaPoly', { latlngs: pts });
      setPts([]); setRaton(null);
    },
    mousemove(e) {
      if (!herramienta || pts.length === 0 || puntoMarcado != null) return;
      setRaton(imantar(e.latlng));
    },
  });

  // Presionar y arrastrar: el 2.º y el 3.er punto de la cuadra rectangular
  usePresionarYArrastrar(map, herramienta === 'manzanaRect' && (pts.length === 1 || pts.length === 2) && puntoMarcado == null, {
    alEmpezar: (ll) => setRaton(imantar(ll)),
    alMover: (ll) => setRaton(imantar(ll)),
    alSoltar: (ll) => { setRaton(null); ponerPunto(imantar(ll)); },
    alCancelar: () => setRaton(null),
  });

  // Un punto ya puesto, marcado: se mueve desde lejos
  const moverPunto = ({ dx, dy }) => {
    const base = inicioPunto.current;
    if (!base) return;
    const ll = map.containerPointToLatLng([base.x + dx, base.y + dy]);
    const p = imantar([ll.lat, ll.lng]);
    setPts(pts.map((q, k) => (k === puntoMarcado ? p : q)));
  };
  useArrastreLejos(map, puntoMarcado != null && !!pts[puntoMarcado], {
    alEmpezar: () => { inicioPunto.current = map.latLngToContainerPoint(pts[puntoMarcado]); },
    alMover: moverPunto,
    alSoltar: (d) => { if (d) moverPunto(d); inicioPunto.current = null; },
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
          positions={manzanaViva && String(manzanaViva.id) === String(m.id) ? manzanaViva.latlngs : m.latlngs}
          pathOptions={{
            color: sel('manzana', m.id) ? '#FF6600' : '#E7EAEF',
            weight: sel('manzana', m.id) ? 3 : 2,
            fillColor: sel('manzana', m.id) ? '#FF6600' : '#E7EAEF',
            fillOpacity: sel('manzana', m.id) ? 0.22 : 0.14,
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

      {/* Vértices ya puestos, para ver dónde se ancló el imán. Se tocan para marcarlos
          y moverlos desde lejos. */}
      {herramienta && pts.map((p, i) => (
        <CircleMarker key={i} center={p} radius={puntoMarcado === i ? 8 : 4} interactive={false}
          pathOptions={{ color: '#0F1217', weight: 2, fillColor: puntoMarcado === i ? '#FACC15' : '#FF6600', fillOpacity: 1 }} />
      ))}
      {herramienta && ES_POLIGONO[herramienta] && pts.map((p, i) => (
        <CircleMarker key={`toque-${i}`} center={p} radius={RADIO_TOQUE}
          pathOptions={{ stroke: false, fillColor: '#FFFFFF', fillOpacity: 0.001, className: 'toque-punto' }}
          eventHandlers={{ click: (e) => { L.DomEvent.stop(e); setPuntoMarcado(puntoMarcado === i ? null : i); } }} />
      ))}
    </>
  );
}
