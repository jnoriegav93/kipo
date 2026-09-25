// Firestore de mentira con escuchas que la prueba responde a mano (a diferencia de
// stub-firestore.js, que responde solo). Anota EN ORDEN lo que se escribe, se escucha y
// se cierra, en globalThis.__vivo.registro, y deja cada escucha en
// globalThis.__vivo.escuchas: { ref, path, filtros, next, error, abierta }.
// Si la prueba define globalThis.__vivo.rechazar(path), el setDoc de esa ruta falla; con
// globalThis.__vivo.colgar(path), no termina nunca (un equipo sin señal).
const vivo = () => (globalThis.__vivo ||= { registro: [], escuchas: [], rechazar: null, colgar: null });
const copia = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export const initializeFirestore = () => ({});
export const enableIndexedDbPersistence = async () => {};
export const doc = (_db, ...partes) => ({ tipo: 'doc', path: partes.join('/') });
export const collection = (_db, ...partes) => ({ tipo: 'col', path: partes.join('/') });
export const query = (c, ...filtros) => ({ tipo: 'query', path: c && c.path, filtros });
export const where = (campo, op, val) => ({ campo, op, val });
export const orderBy = () => ({});
export const limit = () => ({});

export const onSnapshot = (ref, next, error) => {
  const e = { ref, path: ref.path, filtros: ref.filtros || [], next, error, abierta: true };
  vivo().escuchas.push(e);
  vivo().registro.push({ op: 'escucha', path: ref.path, filtros: copia(e.filtros) });
  return () => {
    if (!e.abierta) return;
    e.abierta = false;
    vivo().registro.push({ op: 'cierra', path: ref.path, filtros: copia(e.filtros) });
  };
};

const escribir = (op, path, data) => {
  vivo().registro.push({ op, path, data: copia(data) });
  if (vivo().colgar?.(path)) return new Promise(() => {});
  const motivo = vivo().rechazar?.(path);
  return motivo ? Promise.reject(motivo) : Promise.resolve();
};
export const setDoc = (ref, data) => escribir('set', ref.path, data);
export const updateDoc = (ref, data) => escribir('update', ref.path, data);
export const deleteDoc = (ref) => escribir('delete', ref.path);
export const addDoc = async (c, data) => { await escribir('add', c.path, data); return { id: 'nuevo' }; };
export const getDoc = async (ref) => ({ id: String(ref.path).split('/').pop(), exists: () => false, data: () => undefined });
export const getDocs = async () => ({ docs: [], empty: true, size: 0, forEach: () => {} });
export const writeBatch = () => ({ set() {}, update() {}, delete() {}, commit: async () => {} });
export const deleteField = () => ({ __op: 'deleteField' });
export const arrayUnion = (...v) => ({ __op: 'arrayUnion', v });
export const arrayRemove = (...v) => ({ __op: 'arrayRemove', v });
export const serverTimestamp = () => ({ __op: 'serverTimestamp' });
export const Timestamp = { now: () => ({ toMillis: () => Date.now(), toDate: () => new Date() }) };

// Para responder desde la prueba
export const snapConsulta = (docs) => {
  const lista = docs.map(d => ({ id: String(d.id), data: () => copia(d) }));
  return { docs: lista, empty: lista.length === 0, size: lista.length, forEach: (f) => lista.forEach(f) };
};
export const snapDocumento = (path, data) => ({
  id: String(path).split('/').pop(), exists: () => data !== undefined, data: () => copia(data),
});
