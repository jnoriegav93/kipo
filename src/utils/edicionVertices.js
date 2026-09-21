// EDICIÓN DEL TRAZO DE UNA FIBRA: mover, agregar y quitar vértices.
//
// Aquí va solo la decisión geométrica, sin Leaflet ni React, para poder probarla
// con Node. El arrastre, los tiradores y los botones viven en el mapa.
import { distanciaMetros, proyectarEnSegmento } from './fibraUtils.js';

// Una línea necesita dos puntas: por debajo de esto no hay trazo que dibujar.
export const MIN_VERTICES = 2;

export const puedeQuitar = (vertices = []) => vertices.length > MIN_VERTICES;

// Dónde cae un toque sobre el trazo: en qué tramo y en qué punto EXACTO de la
// línea. Devuelve { idx, punto, dist } con idx = tramo que empieza en ese vértice,
// o null si el toque no cae sobre ningún tramo (quedó más allá de las puntas).
//
// Se usa el pie de la perpendicular y no el toque crudo para que el vértice nuevo
// nazca SOBRE la línea: insertarlo donde cayó el dedo torcería el trazo de entrada.
export const puntoMasCercanoEnTrazo = (vertices = [], punto) => {
  if (!punto || punto.lat == null || vertices.length < 2) return null;
  let mejor = null;
  for (let i = 0; i < vertices.length - 1; i++) {
    const r = proyectarEnSegmento(punto, vertices[i], vertices[i + 1]);
    if (!r) continue;
    if (!mejor || r.dist < mejor.dist) mejor = { idx: i, punto: r.punto, dist: r.dist };
  }
  return mejor;
};

// Agrega un vértice en el tramo donde se tocó, respetando el orden del trazo: el
// nuevo queda ENTRE los dos vértices de ese tramo. Si el toque no cae sobre la
// línea, devuelve el trazo igual: es un toque perdido, no un cambio.
export const insertarVertice = (vertices = [], punto) => {
  const donde = puntoMasCercanoEnTrazo(vertices, punto);
  if (!donde) return vertices;
  return [...vertices.slice(0, donde.idx + 1), donde.punto, ...vertices.slice(donde.idx + 1)];
};

// Quita el vértice indicado. Con solo dos no se quita ninguno: dejaría la fibra
// sin trazo. Un índice fuera de rango no cambia nada.
export const quitarVertice = (vertices = [], idx) => {
  if (!puedeQuitar(vertices)) return vertices;
  if (!Number.isInteger(idx) || idx < 0 || idx >= vertices.length) return vertices;
  return vertices.filter((_, i) => i !== idx);
};

// Mueve un vértice a una coordenada nueva, sin tocar los demás.
export const moverVertice = (vertices = [], idx, punto) => {
  if (!punto || punto.lat == null) return vertices;
  if (!Number.isInteger(idx) || idx < 0 || idx >= vertices.length) return vertices;
  return vertices.map((v, i) => (i === idx ? { lat: punto.lat, lng: punto.lng } : v));
};

// Imán al soltar: si hay un poste a menos de `umbral` metros, el vértice se clava
// en su coordenada exacta. Así un vértice que "parece" estar en el poste lo está
// de verdad, que es lo que después mide el conteo de apoyos y extremos.
//
// Gana el más cercano, no el primero que entre en el radio.
export const UMBRAL_IMAN_POSTE = 2; // metros

export const imantarAPoste = (punto, postes = [], umbral = UMBRAL_IMAN_POSTE) => {
  if (!punto || punto.lat == null) return { punto, imantado: false };
  let mejor = null;
  postes.forEach(p => {
    const c = p?.coords;
    if (c?.lat == null || c?.lng == null) return;
    const d = distanciaMetros(punto, c);
    if (d > umbral) return;
    if (!mejor || d < mejor.d) mejor = { d, punto: { lat: c.lat, lng: c.lng } };
  });
  return mejor ? { punto: mejor.punto, imantado: true } : { punto, imantado: false };
};

// ¿Cambió el trazo respecto al guardado? Decide si el botón de guardar tiene algo
// que hacer. Se compara coordenada a coordenada: mover un vértice y devolverlo a
// su sitio no debería contar como un cambio pendiente.
export const trazoCambio = (original = [], actual = []) => {
  if (original.length !== actual.length) return true;
  return original.some((v, i) => v.lat !== actual[i].lat || v.lng !== actual[i].lng);
};
