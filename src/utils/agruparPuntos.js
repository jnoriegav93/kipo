// ── AGRUPAR PUNTOS CUANDO EL MAPA ESTÁ LEJOS ──────────────────────────────────
// Con mil puntos, alejarse es lo que más pesa: TODOS entran en la vista y el
// navegador los pinta a todos. Dibujar solo lo visible no ayuda ahí (todo es
// visible), así que a cierta distancia los que caen juntos se muestran como una
// burbuja con su cantidad.
//
// Umbrales elegidos por el usuario mirando el zoom en pantalla:
//   17 o más cerca → nada se agrupa, y las etiquetas quedan como estén
//   16             → se ocultan las etiquetas y se agrupa de a 2
//   15             → de a 2
//   14, 13 y más lejos → de a 3
//
// El tope es deliberadamente chico: la idea no es esconder el levantamiento, es
// aliviar la pantalla sin perder la noción de cuántos postes hay.
//
// Todo esto es geometría pura, sin Leaflet ni React, para poder probarlo con Node.

export const SIN_AGRUPAR_DESDE = 17;
export const OCULTAR_ETIQUETAS_DESDE = 16;
// Lado de la celda en píxeles: más o menos la yema de un dedo. Dos puntos que caen
// en la misma celda están, en la pantalla, uno encima del otro.
export const CELDA_PX = 44;

const zoomEntero = (zoom) => Math.round(typeof zoom === 'number' && !Number.isNaN(zoom) ? zoom : 20);

// Cuántos puntos, como mucho, puede juntar una burbuja a este zoom. 1 = no se agrupa.
export const maxDelGrupo = (zoom) => {
  const z = zoomEntero(zoom);
  if (z >= SIN_AGRUPAR_DESDE) return 1;
  if (z >= 15) return 2;
  return 3;
};

// Las etiquetas (ítem y pasivo) se esconden de lejos aunque estén encendidas: a esa
// distancia los globitos se pisan entre sí y no se lee ninguno. Quien las tenga
// activas recibe un aviso de que están ocultas por el zoom, no de que se apagaron.
export const ocultaEtiquetas = (zoom) => zoomEntero(zoom) <= OCULTAR_ETIQUETAS_DESDE;

// Coordenada a píxeles del mundo, con la proyección de siempre de los mapas. Es la
// misma cuenta que hace Leaflet por dentro, pero escrita aquí para no depender de él.
export const aPixeles = (coords, zoom) => {
  const escala = 256 * Math.pow(2, zoomEntero(zoom));
  const lat = Math.max(-85.05112878, Math.min(85.05112878, coords.lat));
  const sen = Math.sin(lat * Math.PI / 180);
  return {
    x: (coords.lng + 180) / 360 * escala,
    y: (0.5 - Math.log((1 + sen) / (1 - sen)) / (4 * Math.PI)) * escala,
  };
};

const coordsDe = (p) => (p?.coords?.lat != null ? p.coords : (p?.lat != null ? p : null));

// Devuelve { sueltos, grupos }. Los sueltos se dibujan como siempre; cada grupo es una
// burbuja con la cantidad, y NUNCA mezcla clases: los postes con los postes, los medios
// tramos con los medios tramos, las cámaras con las cámaras.
export const agruparPuntos = (puntos = [], zoom, opciones = {}) => {
  const {
    claseDe = () => 'poste',
    // Los que están en juego ahora mismo se dibujan siempre enteros, aunque caigan
    // junto a otros: el seleccionado, el temporal, el resaltado, los del trazo.
    siempreSolos = new Set(),
    celda = CELDA_PX,
  } = opciones;

  const max = maxDelGrupo(zoom);
  const sueltos = [];
  if (max <= 1) return { sueltos: [...puntos], grupos: [] };

  const cubos = new Map();
  for (const p of puntos) {
    const coords = coordsDe(p);
    if (!coords || siempreSolos.has(String(p?.id))) { sueltos.push(p); continue; }
    const px = aPixeles(coords, zoom);
    const clase = claseDe(p);
    const clave = `${clase}|${Math.floor(px.x / celda)}|${Math.floor(px.y / celda)}`;
    const cubo = cubos.get(clave);
    if (cubo) cubo.push(p); else cubos.set(clave, [p]);
  }

  const grupos = [];
  for (const [clave, lista] of cubos) {
    // Una celda con más puntos que el tope se parte en varias burbujas, en vez de
    // juntarlos a todos: así el tope elegido se respeta siempre.
    for (let i = 0; i < lista.length; i += max) {
      const trozo = lista.slice(i, i + max);
      if (trozo.length === 1) { sueltos.push(trozo[0]); continue; }
      const suma = trozo.reduce((acc, p) => {
        const c = coordsDe(p);
        return { lat: acc.lat + c.lat, lng: acc.lng + c.lng };
      }, { lat: 0, lng: 0 });
      grupos.push({
        id: `g|${clave}|${i}`,
        clase: clave.split('|')[0],
        cantidad: trozo.length,
        puntos: trozo,
        centro: { lat: suma.lat / trozo.length, lng: suma.lng / trozo.length },
      });
    }
  }
  return { sueltos, grupos };
};
