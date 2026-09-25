// Firestore de mentira para montar la ventana de la obra en jsdom: anota lo que se
// escribe y responde las escuchas de documentos con lo que la prueba deje en
// globalThis.__fs.docs (por ruta). Las consultas responden vacías.
const fs = () => (globalThis.__fs ||= { docs: {}, escrituras: [] });
export const initializeFirestore = () => ({});
export const enableIndexedDbPersistence = async () => {};
export const doc = (_db, ...partes) => ({ tipo: 'doc', path: partes.join('/') });
export const collection = (_db, ...partes) => ({ tipo: 'col', path: partes.join('/') });
export const query = (c, ...filtros) => ({ tipo: 'query', path: c && c.path, filtros });
export const where = (campo, op, val) => ({ campo, op, val });
export const orderBy = () => ({});
export const limit = () => ({});
const snapDoc = (path) => {
  const d = fs().docs[path];
  return { id: String(path).split('/').pop(), exists: () => d !== undefined, data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))) };
};
const snapQuery = () => ({ docs: [], empty: true, size: 0, forEach: () => {} });
export const onSnapshot = (ref, next) => {
  const s = ref && ref.tipo === 'doc' ? snapDoc(ref.path) : snapQuery();
  Promise.resolve().then(() => next && next(s));
  return () => {};
};
export const getDoc = async (ref) => snapDoc(ref.path);
export const getDocs = async () => snapQuery();
export const getDocFromServer = getDoc;
export const getDocsFromServer = getDocs;
export const getCountFromServer = async () => ({ data: () => ({ count: 0 }) });
export const updateDoc = async (ref, data) => { fs().escrituras.push({ op: 'update', path: ref.path, data: JSON.parse(JSON.stringify(data)) }); };
export const setDoc = async (ref, data, o) => { fs().escrituras.push({ op: 'set', path: ref.path, data: JSON.parse(JSON.stringify(data)), o }); };
export const addDoc = async (c, data) => { fs().escrituras.push({ op: 'add', path: c.path, data: JSON.parse(JSON.stringify(data)) }); return { id: 'nuevo' }; };
export const deleteDoc = async (ref) => { fs().escrituras.push({ op: 'delete', path: ref.path }); };
export const deleteField = () => ({ __op: 'deleteField' });
export const arrayUnion = (...v) => ({ __op: 'arrayUnion', v });
export const arrayRemove = (...v) => ({ __op: 'arrayRemove', v });
export const serverTimestamp = () => ({ __op: 'serverTimestamp' });
export const writeBatch = () => ({ set() {}, update() {}, delete() {}, commit: async () => {} });
export const Timestamp = { now: () => ({ toMillis: () => Date.now(), toDate: () => new Date() }) };
