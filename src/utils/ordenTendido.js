// POSICIÓN DE TENDIDO (datos.ordenTendido) al guardar "editar posición" desde el mapa.
// Solo queda con posición lo que se ordenó; el resto queda sin posición, igual que se ve
// en el mapa mientras se ordena. Antes se numeraban también los puntos no tocados.

// puntos: los del proyecto. Sin ordenTrabajo (modo normal): lo ya ordenado que se retomó
// (prefijo) y detrás lo tocado ahora (seleccion). Con ordenTrabajo (corrigiendo): ese
// orden, pero solo con lo que ya tenía posición y lo que se movió.
// Devuelve { orden: ids en su nueva posición 1, 2, 3…, sinPosicion: ids que la pierden }.
export const posicionesAGuardar = ({ puntos = [], prefijo = [], seleccion = [], ordenTrabajo = null, movidos = [] }) => {
  const porId = new Map(puntos.map(p => [String(p.id), p]));
  const tienePosicion = (id) => porId.get(String(id))?.datos?.ordenTendido != null;
  // Cada punto del proyecto una sola vez; lo que no es del proyecto no entra
  const vistos = new Set();
  const tomar = (id) => {
    const clave = String(id);
    if (!porId.has(clave) || vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  };
  let orden;
  if (ordenTrabajo) {
    const movido = new Set(movidos.map(String));
    orden = ordenTrabajo.filter(id => (tienePosicion(id) || movido.has(String(id))) && tomar(id));
  } else {
    orden = [...prefijo, ...seleccion].filter(tomar);
  }
  const sinPosicion = puntos.filter(p => p.datos?.ordenTendido != null && !vistos.has(String(p.id))).map(p => p.id);
  return { orden, sinPosicion };
};
