import { Fragment, useEffect, useState } from 'react';
import { Polygon, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { metrosEntre } from '../utils/disenoGeo';

/* Casas de las manzanas regulares sobre el mapa (formato regular, 25/09).

   Se tocan en dos pasos, como se acordó: el primer toque en una casa elige su manzana
   (ahí va el formato) y, con la manzana ya elegida, el siguiente elige la casa (ahí van
   sus familias). Con una herramienta de dibujo activa el toque sigue de largo hasta el
   mapa, para poder dibujar encima.

   Cada casa lleva su frente en naranja y el número de familias encima, con color según
   la cantidad como en App_Design. El número sale solo si la casa mide en pantalla lo
   bastante para que no tape a las vecinas: con casas de 6 m, desde el zoom 19. De lejos,
   un número por casa era una mancha azul sobre la manzana. */

const COLOR_CASA = '#4A9EFF';
const COLOR_FRENTE = '#FF6B35';
const COLOR_ELEGIDA = '#FACC15';
// 0 gris (no es vivienda), 1 azul, 2 verde, 3 naranja, 4 morado, 5 o más rojo
const COLORES_FAMILIAS = ['#555555', '#1E90FF', '#27AE60', '#F39C12', '#8E44AD', '#E74C3C'];
const PX_MIN_NUMERO = 16; // el lado más corto de la casa, en pantalla, para mostrar su número

// Metros que mide un píxel a esa latitud y zoom (Web Mercator)
const metrosPorPixel = (lat, zoom) => 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
const ladoMasCorto = (pts) => Math.min(...pts.map((p, i) => metrosEntre(p, pts[(i + 1) % pts.length])));

const iconos = {};
const iconoFamilias = (n) => {
  if (!iconos[n]) {
    const color = COLORES_FAMILIAS[Math.min(n, COLORES_FAMILIAS.length - 1)];
    iconos[n] = L.divIcon({
      className: '',
      html: `<div style="transform:translate(-50%,-50%);min-width:18px;height:18px;padding:0 4px;border-radius:9px;
        background:${color};border:1.5px solid #0F1217;color:#fff;font:800 10px system-ui;
        display:flex;align-items:center;justify-content:center;">${n}</div>`,
      iconSize: [0, 0],
    });
  }
  return iconos[n];
};

const centro = (pts) => [
  pts.reduce((s, p) => s + p[0], 0) / pts.length,
  pts.reduce((s, p) => s + p[1], 0) / pts.length,
];

export default function DisenoCasas({ casasPorManzana = {}, vivas = null, visible = true, herramienta, seleccion, onTocarCasa }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => (map.getZoom ? map.getZoom() : 17));
  useEffect(() => {
    if (!map.on) return undefined;
    const alZoom = () => setZoom(map.getZoom());
    map.on('zoomend', alZoom);
    return () => map.off('zoomend', alZoom);
  }, [map]);

  if (!visible) return null;

  return (
    <>
      {Object.entries(casasPorManzana).map(([manzanaId, doc]) => {
        // Mientras se arrastra un vértice, la manzana muestra las casas que le quedarían
        const casas = vivas && String(vivas.manzanaId) === String(manzanaId) ? vivas.casas : (doc?.casas || []);
        const mpp = casas.length ? metrosPorPixel(casas[0].latlngs[0][0], zoom) : 1;
        return (
          <Fragment key={manzanaId}>
            {casas.map(c => {
              const elegida = seleccion?.tipo === 'casa' && String(seleccion.manzanaId) === String(manzanaId) && seleccion.id === c.id;
              const n = c.latlngs.length;
              const conNumero = elegida || ladoMasCorto(c.latlngs) / mpp >= PX_MIN_NUMERO;
              return (
                <Fragment key={c.id}>
                  <Polygon
                    positions={c.latlngs}
                    pathOptions={{
                      color: elegida ? COLOR_ELEGIDA : COLOR_CASA,
                      weight: elegida ? 2.5 : 1.2,
                      fillColor: elegida ? COLOR_ELEGIDA : COLOR_CASA,
                      fillOpacity: elegida ? 0.38 : 0.06,
                    }}
                    eventHandlers={{
                      click: (e) => {
                        if (herramienta) return; // dibujando: el toque es para el mapa
                        L.DomEvent.stop(e);
                        onTocarCasa(manzanaId, c.id);
                      },
                    }}
                  />
                  {c.frente != null && (
                    <Polyline positions={[c.latlngs[c.frente], c.latlngs[(c.frente + 1) % n]]} interactive={false}
                      pathOptions={{ color: COLOR_FRENTE, weight: 3 }} />
                  )}
                  {conNumero && (
                    <Marker position={centro(c.latlngs)} icon={iconoFamilias(Number(c.familias) || 0)} interactive={false} />
                  )}
                </Fragment>
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
}
