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
