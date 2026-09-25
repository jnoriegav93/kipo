// react-leaflet de mentira para tocar el modo Diseño en jsdom (Leaflet no dibuja ahí).
// Cada polígono es un <div> con su color y su trazo en atributos, y el clic llama a su
// `eventHandlers.click` igual que Leaflet. Lo demás no dibuja nada.
import { forwardRef, useImperativeHandle } from 'react';

const mapaFalso = {
  setView() {}, fitBounds() {}, flyTo() {}, getZoom: () => 17,
  latLngToContainerPoint: (ll) => ({ x: (ll.lng ?? ll[1]) * 1e5, y: -(ll.lat ?? ll[0]) * 1e5 }),
  containerPointToLatLng: (p) => ({ lat: -p.y / 1e5, lng: p.x / 1e5 }),
  latLngToLayerPoint: (ll) => ({ x: (ll.lng ?? ll[1]) * 1e5, y: -(ll.lat ?? ll[0]) * 1e5 }),
  layerPointToLatLng: (p) => ({ lat: -(p.y ?? p[1]) / 1e5, lng: (p.x ?? p[0]) / 1e5 }),
};

export const MapContainer = forwardRef(function MapContainer({ children }, ref) {
  useImperativeHandle(ref, () => mapaFalso);
  return <div data-mapa="">{children}</div>;
});
export const useMap = () => mapaFalso;
export const useMapEvents = (handlers) => { globalThis.__eventosMapa = handlers; return mapaFalso; };
export const TileLayer = () => null;
export const Pane = ({ children }) => <>{children}</>;
export const Polyline = () => null;
export const Marker = () => null;
export const CircleMarker = () => null;
export const Circle = () => null;
export const Polygon = ({ pathOptions = {}, eventHandlers = {} }) => (
  <div
    data-poligono=""
    data-color={pathOptions.color || ''}
    data-trazo={pathOptions.dashArray || ''}
    onClick={(e) => eventHandlers.click && eventHandlers.click(e)}
  />
);
