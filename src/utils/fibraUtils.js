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
export const agruparPorTramo = (conexiones) => {
  const grupos = {};
  conexiones.forEach(con => {
    const a = String(con.from);
    const b = String(con.to);
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(con);
  });
  return grupos;
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
