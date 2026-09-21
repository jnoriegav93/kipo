// RESCATE DE FIBRAS SIN GEOMETRÍA PROPIA
//
// Las fibras viejas se dibujaban poste por poste y no guardaban su trazo: su forma
// se deducía al vuelo de dónde estuvieran esos postes. Las nuevas guardan `vertices`
// y son independientes del poste.
//
// Antes de poder borrar ese respaldo (`puntos` / `from` / `to`), hay que darle
// geometría propia a las que no la tienen, o al quitarlo dejarían de dibujarse. Esto
// hace una sola vez lo que el respaldo hacía en cada render: convierte la lista de
// postes en una lista de coordenadas y la guarda.
//
// Es preferible a comprobar "¿quedan fibras viejas?" y confiar en la respuesta: no
// depende de que la consulta estuviera bien hecha ni de que mañana no aparezca una
// en otro proyecto que hoy no se miró.

// ¿Esta fibra necesita rescate? Solo si NO tiene un trazo propio utilizable.
export const necesitaVertices = (con) => {
  const vs = Array.isArray(con?.vertices) ? con.vertices : [];
  return vs.filter(v => v && v.lat != null && v.lng != null).length < 2;
};

// Los postes por los que pasaba, en orden. `puntos` es la lista completa; `from`/`to`
// son el respaldo más viejo todavía, de cuando una fibra iba de un poste a otro.
export const postesDeFibraVieja = (con) => {
  const lista = Array.isArray(con?.puntos) && con.puntos.length >= 2
    ? con.puntos
    : [con?.from, con?.to];
  return lista.filter(id => id != null && id !== '').map(String);
};

// Construye el trazo con la posición ACTUAL de esos postes. Devuelve null si no se
// puede: sin al menos dos postes con coordenadas no hay línea que dibujar, y en ese
// caso la fibra ya era invisible antes de tocar nada.
//
// Los vértices salen SIN `puntoId`: la fibra queda suelta, que es justamente adonde
// se quiere llegar. Borrar el poste ya no le hace nada.
export const verticesDesdePostes = (con, buscarPunto) => {
  const vs = postesDeFibraVieja(con)
    .map(id => buscarPunto(id))
    .filter(p => p?.coords?.lat != null && p?.coords?.lng != null)
    .map(p => ({ lat: p.coords.lat, lng: p.coords.lng }));
  return vs.length >= 2 ? vs : null;
};

// Qué hay que escribir, mirando todas las fibras de una vez. Devuelve:
//   rescatadas  → [{ id, vertices }] listas para guardar
//   perdidas    → ids que no se pudieron reconstruir (sus postes ya no existen)
//   sanas       → cuántas ya tenían geometría y no se tocan
// Función pura: no escribe nada, solo decide. Así se puede probar con Node.
export const planRescateFibras = (conexiones = [], puntos = []) => {
  const porId = new Map(puntos.map(p => [String(p.id), p]));
  const buscar = (id) => porId.get(String(id));
  const rescatadas = [];
  const perdidas = [];
  let sanas = 0;
  conexiones.forEach(con => {
    if (!necesitaVertices(con)) { sanas++; return; }
    const vertices = verticesDesdePostes(con, buscar);
    if (vertices) rescatadas.push({ id: String(con.id), vertices });
    else perdidas.push(String(con.id));
  });
  return { rescatadas, perdidas, sanas };
};
