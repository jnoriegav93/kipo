// Capacidades disponibles de fibra óptica
export const CAPACIDADES = [1, 2, 4, 6, 12, 24, 48, 96, 144];

// Colores por capacidad
export const COLORES_FIBRA = {
  1:   '#ffffff',  // blanco
  2:   '#4b5563',  // gris oscuro
  4:   '#000000',  // negro
  6:   '#8b5cf6',  // morado
  12:  '#3b82f6',  // azul
  24:  '#ec4899',  // magenta
  48:  '#f97316',  // naranja
  96:  '#ef4444',  // rojo
  144: '#84cc16',  // verde limón
};

export const getColorFibra = (capacidad) => COLORES_FIBRA[capacidad] || '#3b82f6';

// Agrupar conexiones por par de postes (para offset paralelo)
// Agrupa los segmentos que ocupan el MISMO vano, para poder separarlos visualmente.
// Antes se agrupaba por el par de ids de poste, pero ahora una fibra tiene geometría
// propia y puede no pasar por ningún poste: la clave se arma con las coordenadas.
// Se redondea a 6 decimales (~10 cm) para que dos trazos dibujados sobre el mismo
// vano caigan en el mismo grupo aunque no sean idénticos al bit.
export const agruparPorTramo = (segmentos) => {
  const r = (v) => Math.round(v * 1e6) / 1e6;
  const clave = (seg) => {
    if (seg.coordA && seg.coordB) {
      const a = `${r(seg.coordA.lat)},${r(seg.coordA.lng)}`;
      const b = `${r(seg.coordB.lat)},${r(seg.coordB.lng)}`;
      return a < b ? `${a}|${b}` : `${b}|${a}`;
    }
    const a = String(seg.from), b = String(seg.to);
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  };
  const grupos = {};
  segmentos.forEach(seg => {
    const key = clave(seg);
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(seg);
  });
  return grupos;
};

// Distancia en metros entre dos coordenadas (aproximación plana, exacta de sobra a
// escala de un proyecto de fibra).
export const distanciaMetros = (a, b) => {
  const R = 111320; // metros por grado de latitud
  const dLat = (b.lat - a.lat) * R;
  const dLng = (b.lng - a.lng) * R * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

// Largo total de un trazo, en metros.
export const longitudFibra = (vertices = []) => {
  let total = 0;
  for (let i = 0; i < vertices.length - 1; i++) total += distanciaMetros(vertices[i], vertices[i + 1]);
  return total;
};

// Calcular posiciones con offset perpendicular para fibras paralelas
export const calcularOffsetCoords = (posA, posB, indice, total, spacing = 0.00004) => {
  if (total <= 1) return [posA, posB];

  // Vector dirección A → B
  const dx = posB[1] - posA[1]; // lng
  const dy = posB[0] - posA[0]; // lat

  // Vector perpendicular normalizado
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return [posA, posB];
  const nx = -dy / len; // perpendicular lat
  const ny = dx / len;  // perpendicular lng

  // Offset centrado
  const offset = (indice - (total - 1) / 2) * spacing;

  return [
    [posA[0] + nx * offset, posA[1] + ny * offset],
    [posB[0] + nx * offset, posB[1] + ny * offset]
  ];
};

// ── AJUSTE DE POSTES A LA FIBRA ─────────────────────────────────────────────

// Proyección perpendicular de un punto sobre un segmento. Se trabaja en un plano
// métrico local (los grados se pasan a metros) porque a escala de un proyecto la
// curvatura de la Tierra no cambia nada y la matemática queda simple.
// Devuelve null si el pie de la perpendicular cae FUERA del segmento: en ese caso
// el poste no está al costado de la línea sino más allá de su extremo, y pegarlo
// al extremo apilaría postes en el mismo sitio.
export const proyectarEnSegmento = (p, a, b) => {
  const mLat = 111320;
  const mLng = 111320 * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180);
  const bx = (b.lng - a.lng) * mLng, by = (b.lat - a.lat) * mLat;
  const px = (p.lng - a.lng) * mLng, py = (p.lat - a.lat) * mLat;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return null;
  const t = (px * bx + py * by) / len2;
  if (t < 0 || t > 1) return null;
  const qx = bx * t, qy = by * t;
  return {
    dist: Math.hypot(px - qx, py - qy),
    punto: { lat: a.lat + qy / mLat, lng: a.lng + qx / mLng }
  };
};

// De todas las fibras candidatas, ¿a cuál se pega este poste?
// Regla: gana la de MAYOR CAPACIDAD; si empatan, la MÁS LARGA. Así un poste entre
// una troncal y una derivación se apoya en la troncal.
// `fibras` = [{ id, capacidad, vertices: [{lat,lng}], largo }]
export const mejorProyeccion = (punto, fibras, umbralMetros) => {
  let ganadora = null;
  fibras.forEach(f => {
    let cerca = null;
    for (let i = 0; i < f.vertices.length - 1; i++) {
      const r = proyectarEnSegmento(punto, f.vertices[i], f.vertices[i + 1]);
      if (!r || r.dist > umbralMetros) continue;
      if (!cerca || r.dist < cerca.dist) cerca = r;
    }
    if (!cerca) return;
    const mejor = !ganadora
      || f.capacidad > ganadora.capacidad
      || (f.capacidad === ganadora.capacidad && f.largo > ganadora.largo);
    if (mejor) ganadora = { fibraId: f.id, capacidad: f.capacidad, largo: f.largo, dist: cerca.dist, destino: cerca.punto };
  });
  return ganadora;
};

// Vértices utilizables de una conexión: los propios si los tiene, y si es una
// fibra vieja se deducen de sus postes.
export const verticesDeConexion = (con, buscarPunto) => {
  if (Array.isArray(con.vertices) && con.vertices.length >= 2) {
    return con.vertices.filter(v => v && v.lat != null && v.lng != null).map(v => ({ lat: v.lat, lng: v.lng }));
  }
  const ids = (con.puntos?.length >= 2 ? con.puntos : [con.from, con.to]).filter(Boolean);
  return ids.map(id => buscarPunto(id)).filter(p => p?.coords).map(p => ({ lat: p.coords.lat, lng: p.coords.lng }));
};

// Borrar un poste no borra las fibras que pasan por él: las suelta. El vértice que
// estaba clavado en el poste se queda en su sitio como vértice libre y el poste sale
// de la lista de postes por los que pasa. Una fibra vieja, sin trazo propio, toma
// primero el trazo de sus postes para no perder la forma. Devuelve los campos a
// guardar, o null si la fibra no toca ese punto.
export const soltarFibraDePunto = (con, puntoId, buscarPunto) => {
  const id = String(puntoId);
  const idsPostes = (con.puntos?.length >= 2 ? con.puntos : [con.from, con.to]).filter(Boolean).map(String);
  const propios = Array.isArray(con.vertices) && con.vertices.length >= 2
    ? con.vertices.filter(v => v && v.lat != null && v.lng != null)
    : null;
  const clavada = (propios || []).some(v => String(v.puntoId) === id);
  if (!clavada && !idsPostes.includes(id)) return null;
  const trazo = propios || idsPostes.map(pid => {
    const p = buscarPunto(pid);
    return p?.coords?.lat != null ? { lat: p.coords.lat, lng: p.coords.lng, puntoId: pid } : null;
  }).filter(Boolean);
  const vertices = trazo.map(v => (String(v.puntoId) === id ? { lat: v.lat, lng: v.lng } : v));
  const puntos = vertices.filter(v => v.puntoId != null).map(v => String(v.puntoId));
  return { vertices, puntos, from: puntos[0] || null, to: puntos[puntos.length - 1] || null };
};

// ── QUÉ FIBRAS TOCAN UN POSTE ───────────────────────────────────────────────

// Distancia mínima de un punto a toda la polilínea: se mide contra cada vértice y
// contra cada tramo, porque la perpendicular puede caer fuera del tramo y entonces
// el punto más cercano es un vértice.
export const distanciaAPolilinea = (p, vs) => {
  let min = Infinity;
  for (const v of vs) min = Math.min(min, distanciaMetros(p, v));
  for (let i = 0; i < vs.length - 1; i++) {
    const r = proyectarEnSegmento(p, vs[i], vs[i + 1]);
    if (r) min = Math.min(min, r.dist);
  }
  return min;
};

// Fibras que pasan por un poste, dentro de un radio en metros.
// Es EXTREMO si lo más cercano del ramal es su primer o último vértice (la fibra
// termina ahí); en cualquier otro caso pasa de largo y es APOYO.
// Solo se consideran ramales con geometría propia: los antiguos no se cuentan.
export const fibrasEnPoste = (punto, conexiones = [], umbral = 3) => {
  const res = [];
  conexiones.forEach(c => {
    const vs = Array.isArray(c.vertices) ? c.vertices.filter(v => v && v.lat != null) : [];
    if (vs.length < 2) return;
    if (distanciaAPolilinea(punto, vs) > umbral) return;
    const aExtremo = Math.min(
      distanciaMetros(punto, vs[0]),
      distanciaMetros(punto, vs[vs.length - 1])
    );
    res.push({
      id: c.id,
      nombre: c.nombre || '',
      capacidad: c.capacidad || 12,
      tipo: aExtremo <= umbral ? 'extremo' : 'apoyo'
    });
  });
  return res;
};

// Lo anterior agrupado por capacidad, de mayor a menor:
// [{ capacidad: 48, apoyos: 1, extremos: 0 }, …]
// En un medio tramo los apoyos no salen de la cercanía, que también cuenta las fibras
// que pasan de frente: son las marcadas en sus cables de acero (`apoyosElegidos`, un
// Set de ids). Los extremos se miden igual en todos los puntos.
export const resumenFibrasEnPoste = (punto, conexiones = [], umbral = 3, apoyosElegidos = null) => {
  const mapa = new Map();
  const sumar = (capacidad, campo) => {
    if (!mapa.has(capacidad)) mapa.set(capacidad, { capacidad, apoyos: 0, extremos: 0 });
    mapa.get(capacidad)[campo]++;
  };
  fibrasEnPoste(punto, conexiones, umbral).forEach(f => {
    // Una fibra elegida como apoyo no cuenta además como extremo
    if (f.tipo === 'extremo') { if (!apoyosElegidos?.has(String(f.id))) sumar(f.capacidad, 'extremos'); }
    else if (!apoyosElegidos) sumar(f.capacidad, 'apoyos');
  });
  if (apoyosElegidos) {
    conexiones.forEach(c => { if (apoyosElegidos.has(String(c.id))) sumar(c.capacidad || 12, 'apoyos'); });
  }
  return [...mapa.values()].sort((a, b) => b.capacidad - a.capacidad);
};

// Punto más cercano de una polilínea a un punto dado, con el tramo donde cae.
const masCercanoEnPolilinea = (p, vs) => {
  let mejor = null;
  for (let i = 0; i < vs.length - 1; i++) {
    const r = proyectarEnSegmento(p, vs[i], vs[i + 1]);
    const cand = r
      ? { punto: r.punto, dist: r.dist, a: vs[i], b: vs[i + 1] }
      : null;
    if (cand && (!mejor || cand.dist < mejor.dist)) mejor = cand;
  }
  // La perpendicular puede caer fuera de todos los tramos: entonces manda un vértice
  for (const v of vs) {
    const d = distanciaMetros(p, v);
    if (!mejor || d < mejor.dist) mejor = { punto: v, dist: d, a: vs[0], b: vs[1] };
  }
  return mejor;
};

// Aparta un vértice nuevo de las fibras ya dibujadas, como imanes que se repelen:
// si cae a menos del umbral de otro ramal (1 m), se recoloca a esa distancia exacta, hacia
// el lado por el que ya se inclinaba. Sustituye al rechazo con aviso, que obligaba a
// tantear dónde sí se podía tocar.
export const separarDeFibras = (v, conexiones = [], umbral = 1, idIgnorar = null, referencia = null) => {
  let res = { ...v };
  // Varias pasadas: al alejarse de una fibra podría quedar cerca de otra.
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    let peor = null;
    conexiones.forEach(c => {
      if (idIgnorar != null && String(c.id) === String(idIgnorar)) return;
      const vs = Array.isArray(c.vertices) ? c.vertices.filter(x => x && x.lat != null) : [];
      if (vs.length < 2) return;
      const r = masCercanoEnPolilinea(res, vs);
      if (r && r.dist < umbral && (!peor || r.dist < peor.dist)) peor = r;
    });
    if (!peor) break;

    const o = peor.punto;
    const mLat = 111320, mLng = 111320 * Math.cos(o.lat * Math.PI / 180);
    const enMetros = (p) => ({ x: (p.lng - o.lng) * mLng, y: (p.lat - o.lat) * mLat });
    // Perpendicular al tramo más cercano de la fibra existente
    const dx = (peor.b.lng - peor.a.lng) * mLng, dy = (peor.b.lat - peor.a.lat) * mLat;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    const n = { x: -dy / l, y: dx / l };

    // De qué lado ponerlo. Manda el vértice ANTERIOR del trazo: si el nuevo cayera al
    // otro lado, el tramo atravesaría la fibra existente, que es justo lo que no se
    // quiere. Solo si no hay anterior (o está sobre la línea) decide la inclinación
    // del propio toque.
    const proy = (p) => { const m = enMetros(p); return m.x * n.x + m.y * n.y; };
    let signo = referencia ? proy(referencia) : 0;
    if (Math.abs(signo) < 0.05) signo = proy(res);
    if (Math.abs(signo) < 1e-6) signo = 1;
    const s2 = signo < 0 ? -1 : 1;

    res = { ...res, lat: o.lat + n.y * s2 * umbral / mLat, lng: o.lng + n.x * s2 * umbral / mLng };
  }
  return res;
};
