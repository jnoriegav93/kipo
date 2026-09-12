/* Geometría del modo Diseño. Vive fuera de los componentes para poder
   reutilizarse en las fases siguientes (tramos, NAPs) sin arrastrar interfaz. */

/* Rectángulo a partir de tres puntos: los dos primeros fijan la base y el
   tercero el ancho, proyectado sobre la perpendicular. El cálculo va en píxeles
   de pantalla, no en grados: un rectángulo "recto" en lat/lng se ve torcido a
   estas latitudes, y lo que importa es que los cuatro ángulos se vean rectos. */
export const rectangulo3Puntos = (map, p1, p2, pRaton) => {
  const a = map.latLngToLayerPoint(p1);
  const b = map.latLngToLayerPoint(p2);
  const m = map.latLngToLayerPoint(pRaton);

  const dx = b.x - a.x, dy = b.y - a.y;
  const largo = Math.hypot(dx, dy);
  if (largo < 1) return [p1, p2];

  const nx = -dy / largo, ny = dx / largo;           // perpendicular unitaria
  const ancho = (m.x - a.x) * nx + (m.y - a.y) * ny; // proyección del ratón

  const c = map.layerPointToLatLng([b.x + nx * ancho, b.y + ny * ancho]);
  const d = map.layerPointToLatLng([a.x + nx * ancho, a.y + ny * ancho]);
  return [p1, p2, [c.lat, c.lng], [d.lat, d.lng]];
};

/* Área del polígono en m², por la fórmula del cordón sobre un plano local. */
export const areaM2 = (pts) => {
  if (!pts || pts.length < 3) return 0;
  const latRef = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const kx = Math.cos(latRef * Math.PI / 180) * 111320;
  const ky = 111320;
  let suma = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    suma += (a[1] * kx) * (b[0] * ky) - (b[1] * kx) * (a[0] * ky);
  }
  return Math.abs(suma / 2);
};

/* ── Geometría de calles ──────────────────────────────────────────────────
   Todo trabaja con pares [lat, lng] y una proyección plana local: a escala de
   un barrio el error es de centímetros y evita arrastrar una librería entera. */

const M_LAT = 111320;
const mLng = (lat) => M_LAT * Math.cos(lat * Math.PI / 180);

/* Pasa a metros relativos a un origen, y vuelve. */
export const aMetros = (p, ref) => [(p[1] - ref[1]) * mLng(ref[0]), (p[0] - ref[0]) * M_LAT];
export const aGrados = (v, ref) => [ref[0] + v[1] / M_LAT, ref[1] + v[0] / mLng(ref[0])];

export const metrosEntre = (a, b) => {
  const dLat = (b[0] - a[0]) * M_LAT;
  const dLng = (b[1] - a[1]) * M_LAT * Math.cos((a[0] + b[0]) / 2 * Math.PI / 180);
  return Math.hypot(dLat, dLng);
};

export const largoPolilinea = (pts = []) => {
  let t = 0;
  for (let i = 0; i < pts.length - 1; i++) t += metrosEntre(pts[i], pts[i + 1]);
  return t;
};

/* Ángulo del segmento en grados, 0 = este, sentido antihorario. */
export const anguloSegmento = (a, b) => {
  const v = aMetros(b, a);
  return Math.atan2(v[1], v[0]) * 180 / Math.PI;
};

/* Imán de ángulo: si el segmento nuevo queda a menos de `tol` grados de un
   múltiplo de 90° respecto al anterior, se ajusta exacto. Las manzanas urbanas
   son casi siempre ortogonales, así que esto da precisión sin pelear con el pulso. */
export const ajustarAngulo = (pAnterior, pActual, pDestino, tol = 7) => {
  if (!pAnterior) return { punto: pDestino, imantado: false };
  const base = anguloSegmento(pAnterior, pActual);
  const actual = anguloSegmento(pActual, pDestino);
  let mejor = null, dif = tol;
  for (let k = 0; k < 4; k++) {
    const objetivo = base + k * 90;
    let d = ((actual - objetivo + 540) % 360) - 180;
    if (Math.abs(d) < dif) { dif = Math.abs(d); mejor = objetivo; }
  }
  if (mejor === null) return { punto: pDestino, imantado: false };
  const largo = metrosEntre(pActual, pDestino);
  const r = mejor * Math.PI / 180;
  return { punto: aGrados([Math.cos(r) * largo, Math.sin(r) * largo], pActual), imantado: true };
};

/* Paralela a `metros` de distancia, hacia `lado` (+1 / −1). Une los tramos en
   inglete para que las esquinas no se despeguen ni se crucen. */
export const paralela = (pts, metros, lado = 1) => {
  const n = pts.length;
  if (n < 2) return pts.map(p => [...p]);
  const ref = pts[0];
  const V = pts.map(p => aMetros(p, ref));

  const dirs = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = V[i + 1][0] - V[i][0], dy = V[i + 1][1] - V[i][1];
    const L = Math.hypot(dx, dy) || 1;
    dirs.push([dx / L, dy / L]);
  }

  const normal = (d) => [d[1] * lado, -d[0] * lado];
  const salida = [];
  for (let i = 0; i < n; i++) {
    const d1 = dirs[i - 1] || dirs[0];
    const d2 = dirs[i] || dirs[n - 2];
    const n1 = normal(d1), n2 = normal(d2);
    let bx = n1[0] + n2[0], by = n1[1] + n2[1];
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl; by /= bl;
    // Inglete: en una esquina cerrada el punto se aleja más que el ancho recto
    const cos = Math.max(0.25, bx * n1[0] + by * n1[1]);
    const d = metros / cos;
    salida.push(aGrados([V[i][0] + bx * d, V[i][1] + by * d], ref));
  }
  return salida;
};

/* Proyección de un punto sobre una polilínea: en qué segmento cae, dónde, y a
   cuántos metros. Sirve para insertar vértices y para medir anchos. */
export const proyectarEnPolilinea = (pts, p) => {
  if (!pts || pts.length < 2) return null;
  const ref = pts[0];
  const P = aMetros(p, ref);
  let mejor = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const A = aMetros(pts[i], ref), B = aMetros(pts[i + 1], ref);
    const vx = B[0] - A[0], vy = B[1] - A[1];
    const len2 = vx * vx + vy * vy;
    if (len2 < 1e-9) continue;
    const t = Math.max(0, Math.min(1, ((P[0] - A[0]) * vx + (P[1] - A[1]) * vy) / len2));
    const q = [A[0] + vx * t, A[1] + vy * t];
    const d = Math.hypot(P[0] - q[0], P[1] - q[1]);
    if (!mejor || d < mejor.dist) mejor = { seg: i, t, dist: d, punto: aGrados(q, ref) };
  }
  return mejor;
};

/* Ancho local de la calle en un punto del borde: distancia al borde de enfrente. */
export const anchoLocal = (otro, p) => {
  const pr = proyectarEnPolilinea(otro, p);
  return pr ? Math.round(pr.dist * 10) / 10 : null;
};

/* Ancho mínimo y máximo de la calle, medido desde cada vértice de un borde hasta
   el borde de enfrente. Es lo que el panel enseña mientras se edita. */
export const anchosCalle = (A, B) => {
  const medidas = [...A.map(p => anchoLocal(B, p)), ...B.map(p => anchoLocal(A, p))].filter(v => v != null);
  return medidas.length ? { min: Math.min(...medidas), max: Math.max(...medidas) } : null;
};

/* Inserta un vértice sobre la polilínea, en el punto de ella más cercano a `p`. */
export const insertarVertice = (pts, p) => {
  const pr = proyectarEnPolilinea(pts, p);
  if (!pr) return pts;
  return [...pts.slice(0, pr.seg + 1), pr.punto, ...pts.slice(pr.seg + 1)];
};

// Quita vértices pegados (a menos de 1 cm): dejarían tramos de largo cero
const sinRepetidos = (pts) => pts.filter((p, i) => i === 0 || metrosEntre(pts[i - 1], p) > 0.01);

/* Parte una calle en dos con un punto sobre cada borde. Los dos bordes van en el
   mismo sentido —el B nace como paralela del A—, así que el primer trozo de uno
   casa con el primer trozo del otro. Devuelve null si algún trozo queda por debajo
   de `minimo` metros: un corte en la misma punta no parte nada. */
export const cortarCalle = (A, B, pA, pB, minimo = 1) => {
  const partir = (pts, p) => {
    const pr = proyectarEnPolilinea(pts, p);
    if (!pr) return null;
    return [
      sinRepetidos([...pts.slice(0, pr.seg + 1), pr.punto]),
      sinRepetidos([[...pr.punto], ...pts.slice(pr.seg + 1)]),
    ];
  };
  const a = partir(A, pA);
  const b = partir(B, pB);
  if (!a || !b) return null;
  if ([...a, ...b].some(t => t.length < 2 || largoPolilinea(t) < minimo)) return null;
  return [{ A: a[0], B: b[0] }, { A: a[1], B: b[1] }];
};

/* ── Formato de guardado ──────────────────────────────────────────────────
   Firestore no acepta un array directamente dentro de otro, y la geometría del
   diseño son listas de pares [lat, lng]: con una sola manzana o calle, la capa
   entera se rechazaba. Al guardar, cada par que va dentro de una lista pasa a
   {lat, lng} —el formato de los vértices de fibra— y al leer se deshace. Un par
   suelto (centro de un círculo, posición de un marcador) no está anidado y viaja
   tal cual. En memoria el diseño trabaja siempre con pares. */

const esPar = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number';
const esLatLng = (v) => v != null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === 2 && typeof v.lat === 'number' && typeof v.lng === 'number';
const esObjetoPlano = (v) => v != null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

export const aFirestore = (v) => {
  if (Array.isArray(v)) return v.map(e => (esPar(e) ? { lat: e[0], lng: e[1] } : aFirestore(e)));
  if (esObjetoPlano(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, aFirestore(x)]));
  return v;
};

export const desdeFirestore = (v) => {
  if (Array.isArray(v)) return v.map(e => (esLatLng(e) ? [e.lat, e.lng] : desdeFirestore(e)));
  if (esObjetoPlano(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, desdeFirestore(x)]));
  return v;
};
