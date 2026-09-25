import { Polygon } from 'react-leaflet';
import L from 'leaflet';

/* Candidatas a manzana generadas desde las calles (utils/disenoManzanas.js). Naranja
   punteado entra, gris no; un toque la alterna. Van encima de todo lo demás, así el
   toque no selecciona la calle o la manzana de abajo. */
export default function DisenoCandidatas({ candidatas = [], onAlternar }) {
  return candidatas.map((c, i) => (
    <Polygon
      key={i}
      positions={c.latlngs}
      pathOptions={c.incluida
        ? { color: '#FF6600', weight: 2.5, dashArray: '7 5', fillColor: '#FF6600', fillOpacity: 0.22 }
        : { color: '#8B94A5', weight: 1.5, dashArray: '4 4', fillColor: '#8B94A5', fillOpacity: 0.08 }}
      eventHandlers={{ click: (e) => { L.DomEvent.stop(e); onAlternar(i); } }}
    />
  ));
}
