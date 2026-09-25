/* Casas de las manzanas regulares: el formato regular del modo Diseño (25/09).

   Portado de App_Design (modules/m1-catastro/js/blocks.js). La cuadra se reparte por
   interpolación bilineal entre sus cuatro esquinas, así que sirve igual si después se
   movió un vértice y dejó de ser recta: sigue siendo de cuatro lados.

   Formatos:
   - Dos filas: dos filas espalda con espalda, `n` casas en cada una.
   - Tres zonas: un cuarto del largo en cada costado, con `nLat` casas que dan a la calle
     del costado; en el medio, dos filas de `nCentro` casas.
   - Una fila: `n` casas que ocupan todo el fondo.

   Girar cambia qué lado es la base de las filas (A-B). En Dos filas y Tres zonas hay dos
   sentidos: los otros dos repetirían las mismas casas. En Una fila hay cuatro, porque
   además elige a qué calle dan las casas.

   Al generar va una casa cada 6 m a lo largo de la fila (el usuario, 25/09), con las
   filas a lo largo del lado más largo.

   El frente de cada casa es el lado de la manzana sobre el que está. La de esquina toca
   dos: su frente va al lado con más casas intermedias y, si empatan, al de su frente más
   largo (regla del 24/09; en App_Design contaban los dos). En Una fila el fondo no
   cuenta: las casas dan al lado elegido con Girar. */
import { metrosEntre } from './disenoGeo.js';

export const METROS_POR_CASA = 6;
export const MAX_CASAS = 80;
export const FORMATOS = [
  { id: 'dos-filas', label: 'Dos filas' },
  { id: 'tres-zonas', label: 'Tres zonas' },
  { id: 'una-fila', label: 'Una fila' },
];

export const girosDe = (tipo) => (tipo === 'una-fila' ? 4 : 2);
export const siguienteGiro = (tipo, giro) => ((giro || 0) + 1) % girosDe(tipo);

// Una manzana admite el formato regular si tiene cuatro esquinas
export const admiteFormatoRegular = (latlngs) => Array.isArray(latlngs) && latlngs.length === 4;

const limitar = (n) => Math.max(1, Math.min(MAX_CASAS, Math.round(Number(n) || 1)));
const cuantas = (metros) => limitar(metros / METROS_POR_CASA);

// Las cuatro esquinas empezando por la del giro: A-B es la base de las filas
const esquinas = (latlngs, giro) => {
  const s = (((giro || 0) % 4) + 4) % 4;
  const q = latlngs.slice(0, 4);
  return [...q.slice(s), ...q.slice(0, s)];
};

const largoFilas = ([A, B, C, D]) => (metrosEntre(A, B) + metrosEntre(D, C)) / 2;
const fondo = ([A, B, C, D]) => (metrosEntre(B, C) + metrosEntre(A, D)) / 2;

/* Cantidades para un formato: una casa cada 6 m a lo largo de la fila. */
export const cantidadesPorDefecto = (latlngs, tipo, giro = 0) => {
  const q = esquinas(latlngs, giro);
  if (tipo === 'tres-zonas') return { nLat: cuantas(fondo(q)), nCentro: cuantas(largoFilas(q) / 2) };
  return { n: cuantas(largoFilas(q)) };
};

/* Formato al elegirlo (o al girarlo): las cantidades se vuelven a calcular. Sin giro
   dado, las filas van a lo largo del lado más largo. */
export const formatoNuevo = (latlngs, tipo = 'dos-filas', giro = null) => {
  let g = giro;
  if (g == null) {
    const q = latlngs.slice(0, 4);
    g = metrosEntre(q[0], q[1]) >= metrosEntre(q[1], q[2]) ? 0 : 1;
  }
  g = (((g % girosDe(tipo)) + girosDe(tipo)) % girosDe(tipo));
  return { tipo, giro: g, ...cantidadesPorDefecto(latlngs, tipo, g) };
};

const bilineal = (A, B, C, D, u, v) => [
  (1 - u) * (1 - v) * A[0] + u * (1 - v) * B[0] + u * v * C[0] + (1 - u) * v * D[0],
  (1 - u) * (1 - v) * A[1] + u * (1 - v) * B[1] + u * v * C[1] + (1 - u) * v * D[1],
];

/* Celdas del formato en coordenadas (u, v): u a lo largo de A-B, v de A-B hacia D-C. */
const celdasDe = (formato) => {
  const celdas = [];
  const fila = (n, u0, u1, v1, v2) => {
    for (let k = 0; k < n; k++) celdas.push({ u1: u0 + (u1 - u0) * k / n, u2: u0 + (u1 - u0) * (k + 1) / n, v1, v2 });
  };
  const columna = (n, u1, u2) => {
    for (let k = 0; k < n; k++) celdas.push({ u1, u2, v1: k / n, v2: (k + 1) / n });
  };
  if (formato.tipo === 'dos-filas') {
    const n = limitar(formato.n);
    fila(n, 0, 1, 0, 0.5);
    fila(n, 0, 1, 0.5, 1);
  } else if (formato.tipo === 'tres-zonas') {
    const nl = limitar(formato.nLat), nc = limitar(formato.nCentro);
    columna(nl, 0, 0.25);
    fila(nc, 0.25, 0.75, 0, 0.5);
    fila(nc, 0.25, 0.75, 0.5, 1);
    columna(nl, 0.75, 1);
  } else if (formato.tipo === 'una-fila') {
    fila(limitar(formato.n), 0, 1, 0, 1);
  }
  return celdas;
};

/* Casas de una manzana de cuatro esquinas con su formato. Cada casa:
   { id, latlngs (4 esquinas), familias: 1, frente (arista de la casa que da a la calle,
   de latlngs[frente] a latlngs[frente + 1]), esquina }. */
export const generarCasas = (latlngs, formato) => {
  if (!admiteFormatoRegular(latlngs) || !formato) return [];
  const [A, B, C, D] = esquinas(latlngs, formato.giro);
  const celdas = celdasDe(formato);

  // Sobre qué lados de la manzana está cada casa. Lado 0 = A-B, 1 = B-C, 2 = C-D, 3 = D-A;
  // la arista k de la casa está sobre el lado k. En Una fila, C-D es el fondo.
  const conLados = celdas.map(c => {
    const pts = [
      bilineal(A, B, C, D, c.u1, c.v1), bilineal(A, B, C, D, c.u2, c.v1),
      bilineal(A, B, C, D, c.u2, c.v2), bilineal(A, B, C, D, c.u1, c.v2),
    ];
    const lados = [];
    if (c.v1 === 0) lados.push(0);
    if (c.u2 === 1) lados.push(1);
    if (c.v2 === 1 && formato.tipo !== 'una-fila') lados.push(2);
    if (c.u1 === 0) lados.push(3);
    return { pts, lados };
  });

  // Casas intermedias (un solo lado) por lado: deciden el frente de las de esquina
  const intermedias = [0, 0, 0, 0];
  conLados.forEach(({ lados }) => { if (lados.length === 1) intermedias[lados[0]]++; });

  return conLados.map(({ pts, lados }, i) => {
    let frente = lados.length ? lados[0] : null;
    if (lados.length > 1) {
      const largo = (k) => metrosEntre(pts[k], pts[(k + 1) % 4]);
      // Largos iguales (al centímetro): el primer lado, para que salga siempre el mismo
      const porLargo = (a, b) => (Math.abs(largo(b) - largo(a)) > 0.01 ? largo(b) - largo(a) : a - b);
      frente = [...lados].sort((a, b) => (intermedias[b] - intermedias[a]) || porLargo(a, b))[0];
    }
    return { id: `c${i + 1}`, latlngs: pts, familias: 1, frente, esquina: lados.length > 1 };
  });
};

export const totalFamilias = (casas = []) => casas.reduce((s, c) => s + (Number(c.familias) || 0), 0);
