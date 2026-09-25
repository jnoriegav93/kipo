// react-leaflet de mentira para tocar el modo Diseño en jsdom (Leaflet no dibuja ahí).
// Cada polígono es un <div> con su color, su trazo y sus puntos en atributos, y el clic
// llama a su `eventHandlers.click` igual que Leaflet. Los círculos y las líneas que se
// pueden tocar (o que llevan `className`) también son un <div>; lo demás no dibuja nada.
//
// El mapa convierte lat/lng a píxeles de forma lineal (x = lng·1e5, y = −lat·1e5), así
// una prueba sabe a qué píxel mandar un toque. `getContainer()` es el <div data-mapa>,
// para los gestos con eventos de puntero, y `dragging` anota si el mapa se puede arrastrar.
//
// Las escuchas de useMapEvents se juntan: `globalThis.__eventosMapa.click(e)` llama al
// `click` de todos los componentes que escuchan el mapa, como hace Leaflet.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const par = (ll) => [ll.lat ?? ll[0], ll.lng ?? ll[1]];
const mapaFalso = {
  setView() {}, fitBounds() {}, flyTo() {}, invalidateSize() {}, on() {}, off() {},
  getZoom: () => 17,
  latLngToContainerPoint: (ll) => ({ x: par(ll)[1] * 1e5, y: -par(ll)[0] * 1e5 }),
  containerPointToLatLng: (p) => ({ lat: -(p.y ?? p[1]) / 1e5, lng: (p.x ?? p[0]) / 1e5 }),
  latLngToLayerPoint: (ll) => ({ x: par(ll)[1] * 1e5, y: -par(ll)[0] * 1e5 }),
  layerPointToLatLng: (p) => ({ lat: -(p.y ?? p[1]) / 1e5, lng: (p.x ?? p[0]) / 1e5 }),
  getContainer: () => mapaFalso._contenedor,
  dragging: {
    _activo: true,
    enable() { this._activo = true; },
    disable() { this._activo = false; },
    enabled() { return this._activo; },
  },
};
globalThis.__mapaFalso = mapaFalso;

const escuchas = new Set();
globalThis.__eventosMapa = new Proxy({}, {
  get: (_, nombre) => (e) => { for (const ref of [...escuchas]) ref.current?.[nombre]?.(e); },
});

export const MapContainer = forwardRef(function MapContainer({ children }, ref) {
  useImperativeHandle(ref, () => mapaFalso);
  return <div data-mapa="" ref={(el) => { if (el) mapaFalso._contenedor = el; }}>{children}</div>;
});
export const useMap = () => mapaFalso;
export const useMapEvents = (manejadores) => {
  const ref = useRef(manejadores);
  useEffect(() => { ref.current = manejadores; });
  useEffect(() => {
    escuchas.add(ref);
    return () => { escuchas.delete(ref); };
  }, []);
  return mapaFalso;
};
export const TileLayer = () => null;
export const Pane = ({ children }) => <>{children}</>;
export const Marker = () => null;
export const Circle = () => null;
export const Polygon = ({ positions = [], pathOptions = {}, eventHandlers = {} }) => (
  <div
    data-poligono=""
    data-color={pathOptions.color || ''}
    data-trazo={pathOptions.dashArray || ''}
    data-puntos={JSON.stringify(positions)}
    onClick={(e) => eventHandlers.click && eventHandlers.click(e)}
  />
);
export const CircleMarker = ({ center, radius, pathOptions = {}, eventHandlers = {} }) => (
  <div
    data-circulo=""
    data-clase={pathOptions.className || ''}
    data-centro={JSON.stringify(center)}
    data-radio={radius}
    onClick={(e) => eventHandlers.click && eventHandlers.click(e)}
  />
);
export const Polyline = ({ positions = [], pathOptions = {}, eventHandlers = {} }) => (
  (eventHandlers.click || pathOptions.className) ? (
    <div
      data-linea=""
      data-clase={pathOptions.className || ''}
      data-puntos={JSON.stringify(positions)}
      onClick={(e) => eventHandlers.click && eventHandlers.click(e)}
    />
  ) : null
);
