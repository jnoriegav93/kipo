/* Manzanas desde las calles (modo Diseño; acordado con el usuario el 24/09, CONTEXTO.md
   "Manzanas, casas y familias"). Lógica pura, sin Leaflet, para probarla con Node.
   Todo se calcula en metros sobre un plano local (aMetros / aGrados) y las operaciones
   de polígonos van con polygon-clipping.

   1. Cada calle es una franja: su borde A y su borde B cerrados en anillo.
   2. Esquinas: cada extremo de borde se prolonga en su dirección hasta 10 m; si en ese
      trayecto corta el borde de otra calle, el extremo llega hasta ahí. Solo para el
      cálculo: las calles guardadas no se mueven.
   3. Se unen todas las franjas y se restan de la envolvente convexa de todos sus
      vértices: lo que queda son los huecos entre calles.
   4. Candidatas: los huecos que no tocan el borde de la envolvente (esos son franjas de
      afuera, no manzanas) y que miden al menos 200 m². La que ya está cubierta por una
      manzana existente sale desmarcada ("ya existe"). */
import polygonClipping from 'polygon-clipping';
import { aMetros, aGrados } from './disenoGeo.js'; // con .js: así también carga en Node (pruebas/)

export const ESQUINA_MAX_M = 10;
export const AREA_MIN_M2 = 200;
const PASADA_M = 0.05; // al cerrar una esquina se pasa 5 cm del borde: sin rendija por redondeo

// Intersección del rayo p + t·d (t en metros, 0 < t ≤ max) con el segmento [a, b]
const cruceRayo = (p, d, max, a, b) => {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const den = d[0] * ey - d[1] * ex;
  if (Math.abs(den) < 1e-12) return null; // paralelos
  const wx = a[0] - p[0], wy = a[1] - p[1];
  const t = (wx * ey - wy * ex) / den;
  const u = (wx * d[1] - wy * d[0]) / den;
  if (t <= 1e-9 || t > max || u < -1e-9 || u > 1 + 1e-9) return null;
  return t;
};

/* Prolonga un extremo (el punto `ext`, que viene de `previo`) hasta el primer borde
   ajeno que encuentre a menos de `max` metros. Devuelve el punto nuevo o null. */
const prolongar = (previo, ext, bordesAjenos, max) => {
  const dx = ext[0] - previo[0], dy = ext[1] - previo[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-6) return null;
  const d = [dx / L, dy / L];
  let mejor = null;
  for (const borde of bordesAjenos) {
    for (let i = 0; i < borde.length - 1; i++) {
      const t = cruceRayo(ext, d, max, borde[i], borde[i + 1]);
      if (t != null && (mejor == null || t < mejor)) mejor = t;
    }
  }
  if (mejor == null) return null;
  const t = mejor + PASADA_M;
  return [ext[0] + d[0] * t, ext[1] + d[1] * t];
};

/* Las calles en metros, con las esquinas cerradas. Cuenta cuántos extremos se movieron. */
export const cerrarEsquinas = (callesM, max = ESQUINA_MAX_M) => {
  let cerradas = 0;
  const salida = callesM.map((c, i) => {
    const ajenos = callesM.filter((_, j) => j !== i).flatMap(o => [o.A, o.B]);
    const cerrar = (borde) => {
      if (borde.length < 2) return borde;
      const nuevo = borde.map(p => [...p]);
      const ini = prolongar(borde[1], borde[0], ajenos, max);
      if (ini) { nuevo[0] = ini; cerradas++; }
      const n = borde.length;
      const fin = prolongar(borde[n - 2], borde[n - 1], ajenos, max);
      if (fin) { nuevo[n - 1] = fin; cerradas++; }
      return nuevo;
    };
    return { ...c, A: cerrar(c.A), B: cerrar(c.B) };
  });
  return { calles: salida, cerradas };
};

// Envolvente convexa (cadena monótona). Puntos [x, y] en metros.
const envolvente = (pts) => {
  const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inf = [];
  for (const p of P) { while (inf.length >= 2 && cruz(inf[inf.length - 2], inf[inf.length - 1], p) <= 0) inf.pop(); inf.push(p); }
  const sup = [];
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (sup.length >= 2 && cruz(sup[sup.length - 2], sup[sup.length - 1], p) <= 0) sup.pop(); sup.push(p); }
  return [...inf.slice(0, -1), ...sup.slice(0, -1)];
};

// Área de un anillo en metros (cordón)
export const areaAnillo = (anillo) => {
  let s = 0;
  for (let i = 0; i < anillo.length; i++) {
    const a = anillo[i], b = anillo[(i + 1) % anillo.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s / 2);
};

const distPuntoSegmento = (p, a, b) => {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy;
  const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2));
  return Math.hypot(p[0] - (a[0] + vx * t), p[1] - (a[1] + vy * t));
};

const tocaEnvolvente = (anillo, env) => anillo.some(p =>
  env.some((a, i) => distPuntoSegmento(p, a, env[(i + 1) % env.length]) < 0.01));

// Sin el punto de cierre que repite al primero
const abierto = (anillo) => {
  const n = anillo.length;
  return n > 1 && anillo[0][0] === anillo[n - 1][0] && anillo[0][1] === anillo[n - 1][1] ? anillo.slice(0, -1) : anillo;
};

/* Candidatas a manzana a partir de las calles guardadas ({ A, B } en [lat, lng]).
   `existentes`: las manzanas ya dibujadas ({ latlngs }). Devuelve
   { candidatas: [{ latlngs, areaM2, incluida, yaExiste }], esquinasCerradas }. */
export const manzanasDesdeCalles = (calles, existentes = [], opciones = {}) => {
  const { esquinaMax = ESQUINA_MAX_M, areaMin = AREA_MIN_M2 } = opciones;
  const validas = (calles || []).filter(c => (c.A || []).length >= 2 && (c.B || []).length >= 2);
  if (validas.length === 0) return { candidatas: [], esquinasCerradas: 0 };
  const ref = validas[0].A[0];
  const callesM = validas.map(c => ({ A: c.A.map(p => aMetros(p, ref)), B: c.B.map(p => aMetros(p, ref)) }));

  const { calles: cerradas, cerradas: esquinasCerradas } = cerrarEsquinas(callesM, esquinaMax);
  const franjas = cerradas.map(c => [[...c.A, ...[...c.B].reverse()]]);
  const union = polygonClipping.union(...franjas);
  const env = envolvente(cerradas.flatMap(c => [...c.A, ...c.B]));
  if (env.length < 3) return { candidatas: [], esquinasCerradas };
  const huecos = polygonClipping.difference([env], union);

  const existentesM = (existentes || [])
    .filter(m => (m.latlngs || []).length >= 3)
    .map(m => [m.latlngs.map(p => aMetros(p, ref))]);

  const candidatas = [];
  for (const pieza of huecos) {
    const anillo = abierto(pieza[0]);
    if (anillo.length < 3) continue;
    const area = areaAnillo(anillo);
    if (area < areaMin) continue;
    if (tocaEnvolvente(anillo, env)) continue;
    // Ya existe si más de la mitad de la candidata está bajo una manzana dibujada
    const cubierta = existentesM.reduce((max, m) => {
      const inter = polygonClipping.intersection([anillo], m);
      const a = inter.reduce((s, poli) => s + areaAnillo(abierto(poli[0])), 0);
      return Math.max(max, a);
    }, 0);
    const yaExiste = cubierta > area * 0.5;
    candidatas.push({
      latlngs: anillo.map(v => aGrados(v, ref)),
      areaM2: Math.round(area),
      incluida: !yaExiste,
      yaExiste,
    });
  }
  return { candidatas, esquinasCerradas };
};
