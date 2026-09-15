// PAPELERA — soft-delete a nivel usuario. Nada se borra de verdad: se guarda un snapshot
// completo del elemento (con su id original) y vive 15 días hasta que la purga del servidor
// lo elimine (junto con sus archivos de Storage). NUNCA borra archivos aquí.
import { collection, addDoc, deleteDoc, doc, setDoc, updateDoc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Extrae recursivamente los paths de Storage (_path/_pathHD) de las fotos de un punto,
// para que la purga (a los 15 días) pueda borrar también los archivos.
export const extraerStoragePaths = (datos) => {
  const paths = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (typeof o._path === 'string' && o._path) paths.push(o._path);
    if (typeof o._pathHD === 'string' && o._pathHD) paths.push(o._pathHD);
    Object.values(o).forEach(v => { if (v && typeof v === 'object') walk(v); });
  };
  walk(datos?.fotos); walk(datos?.fotosGenerales);
  return paths;
};

// Cuenta las fotos reales (con url o miniatura) de los datos de un punto.
export const contarFotos = (datos) => {
  let n = 0;
  const esFoto = (v) => v && (typeof v === 'string'
    ? (v.startsWith('http') || v.startsWith('data:'))
    : (typeof v === 'object' && (v.url || v.thumb)));
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    Object.values(o).forEach(v => {
      if (esFoto(v)) n++;
      else if (v && typeof v === 'object') walk(v);
    });
  };
  walk(datos?.fotos);
  n += (datos?.fotosGenerales || []).filter(esFoto).length;
  return n;
};

export const DIAS_PAPELERA = 15;
const MS_PAPELERA = DIAS_PAPELERA * 24 * 60 * 60 * 1000;

// Cable de acero a la papelera. El snapshot va sin id: al restaurar manda idOriginal.
export const enviarCableAceroAPapelera = ({ uid, cable, proyectoNombre = '', nombre = 'Cable de acero', meta = {} }) => {
  const { id, ...snapshot } = cable;
  return enviarAPapelera({
    uid, tipo: 'acero', snapshot: JSON.parse(JSON.stringify(snapshot)),
    coleccionOriginal: 'cablesAcero', idOriginal: id,
    proyectoId: cable.proyectoId || null, proyectoNombre, nombre, meta,
  });
};

// Envía un elemento a la papelera. tipo: 'punto' | 'fibra' | 'acero' | 'foto' | 'proyecto' | 'lista'.
// snapshot = datos completos para restaurar. meta = extra (ej. fibra: puntos+coords).
export const enviarAPapelera = async ({ uid, tipo, snapshot, coleccionOriginal, idOriginal, proyectoId = null, proyectoNombre = '', nombre = '', storagePaths = [], meta = {} }) => {
  const ahora = Date.now();
  const ref = await addDoc(collection(db, 'papelera'), {
    uid, tipo, snapshot, coleccionOriginal, idOriginal: String(idOriginal),
    proyectoId: proyectoId != null ? String(proyectoId) : null,
    proyectoNombre, nombre, storagePaths, meta,
    eliminadoEn: ahora, expiraEn: ahora + MS_PAPELERA,
  });
  return ref.id;
};

// Suscripción en vivo a la papelera del usuario.
export const suscribirsePapelera = (uid, cb) => {
  if (!uid) { cb([]); return () => {}; }
  const q = query(collection(db, 'papelera'), where('uid', '==', uid));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => cb([]));
};

// Suscripción en vivo a la papelera de UN PROYECTO (lo borrado por cualquier usuario
// del proyecto: puntos, fotos, fibras, listas). El proyecto en sí NO va aquí (ese vive
// en la papelera del menú de su dueño).
export const suscribirsePapeleraProyecto = (proyectoId, cb) => {
  if (!proyectoId) { cb([]); return () => {}; }
  const q = query(collection(db, 'papelera'), where('proyectoId', '==', String(proyectoId)));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.tipo !== 'proyecto')), () => cb([]));
};

export const quitarDePapelera = async (id) => { try { await deleteDoc(doc(db, 'papelera', id)); } catch { /* noop */ } };

const diasRestantes = (entrada) => Math.max(0, Math.ceil(((entrada.expiraEn || 0) - Date.now()) / (24 * 60 * 60 * 1000)));
export { diasRestantes };

// ── Restaurar ────────────────────────────────────────────────────────────────
// Punto: re-crea el doc con su ID y datos originales (incluye coords → ubicación exacta).
export const restaurarPunto = async (entrada) => {
  const s = entrada.snapshot || {};
  await setDoc(doc(db, entrada.coleccionOriginal || 'puntos', String(entrada.idOriginal)), s);
  await quitarDePapelera(entrada.id);
  return { ok: true };
};

// Fibra: SOLO si TODOS sus puntos existen y en la MISMA ubicación de cuando se borró.
export const restaurarFibra = async (entrada, puntosActuales) => {
  const requeridos = (entrada.meta && entrada.meta.puntos) || []; // [{id, coords:{lat,lng}}]
  const faltantes = [];
  for (const req of requeridos) {
    const actual = (puntosActuales || []).find(p => String(p.id) === String(req.id));
    if (!actual) { faltantes.push({ id: req.id, motivo: 'no existe' }); continue; }
    const c1 = actual.coords || {}, c2 = req.coords || {};
    const igual = Math.abs((c1.lat || 0) - (c2.lat || 0)) < 1e-9 && Math.abs((c1.lng || 0) - (c2.lng || 0)) < 1e-9;
    if (!igual) faltantes.push({ id: req.id, motivo: 'movido' });
  }
  if (faltantes.length) return { ok: false, faltantes };
  await setDoc(doc(db, entrada.coleccionOriginal || 'conexiones', String(entrada.idOriginal)), entrada.snapshot || {});
  await quitarDePapelera(entrada.id);
  return { ok: true };
};

// Cable de acero: vuelve si sus dos postes y su medio tramo existen. No hace falta que
// sigan en el mismo sitio: el cable no guarda geometría, se mide siempre desde sus postes.
export const restaurarCableAcero = async (entrada, puntosActuales) => {
  const { puntos = [], medioTramo = null } = entrada.snapshot || {};
  const faltantes = [...puntos, medioTramo].filter(id => id != null).map(String)
    .filter(id => !(puntosActuales || []).some(p => String(p.id) === id))
    .map(id => ({ id, motivo: 'no existe' }));
  if (faltantes.length) return { ok: false, faltantes };
  await setDoc(doc(db, entrada.coleccionOriginal || 'cablesAcero', String(entrada.idOriginal)), entrada.snapshot || {});
  await quitarDePapelera(entrada.id);
  return { ok: true };
};

// Foto de un punto: si el casillero está LIBRE restaura directo; si está OCUPADO devuelve
// la foto actual para que la UI compare y el usuario elija (la reemplazada va a papelera).
export const restaurarFoto = async (entrada, { forzar = false } = {}) => {
  const m = entrada.meta || {};
  // Foto del mapa (fotosProyecto): se re-crea el doc en la subcolección
  if (m.mapa) {
    const proySnap = await getDoc(doc(db, 'proyectos', String(m.proyectoId)));
    if (!proySnap.exists()) return { ok: false, motivo: 'proyecto' }; // el proyecto ya no existe
    await addDoc(collection(db, 'proyectos', m.proyectoId, 'fotosProyecto'), entrada.snapshot || {});
    await quitarDePapelera(entrada.id);
    return { ok: true };
  }
  const ref = doc(db, 'puntos', String(m.puntoId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, motivo: 'punto' }; // el punto ya no existe
  const actual = snap.data()?.datos?.fotos?.[m.section]?.[m.item];
  const ocupado = actual && (typeof actual === 'string' ? actual : (actual.url || actual.thumb));
  if (ocupado && !forzar) return { ok: false, motivo: 'ocupado', fotoActual: actual }; // UI compara
  if (ocupado && forzar) {
    // La foto que estaba ahí va a papelera antes de ser reemplazada (mismo nombre limpio)
    await enviarAPapelera({
      uid: entrada.uid, tipo: 'foto', snapshot: actual, coleccionOriginal: 'puntos',
      idOriginal: `${m.puntoId}_${m.section}_${m.item}`, proyectoId: entrada.proyectoId || null,
      proyectoNombre: entrada.proyectoNombre || '',
      nombre: entrada.nombre || '',
      storagePaths: [actual?._path, actual?._pathHD].filter(Boolean),
      meta: { puntoId: m.puntoId, section: m.section, item: m.item },
    });
  }
  await updateDoc(ref, { [`datos.fotos.${m.section}.${m.item}`]: entrada.snapshot });
  await quitarDePapelera(entrada.id);
  return { ok: true };
};

// Lista de control de ferretería.
export const restaurarLista = async (entrada) => {
  await setDoc(doc(db, entrada.coleccionOriginal || 'controlFerreteria', String(entrada.idOriginal)), entrada.snapshot || {});
  await quitarDePapelera(entrada.id);
  return { ok: true };
};

// Proyecto: restaura el doc del proyecto + TODOS sus hijos agrupados (puntos y fibras que
// se guardaron con meta.grupo = idProyecto al borrarlo). Colaboradores NO se restauran.
export const restaurarProyecto = async (entrada, uid) => {
  const s = { ...(entrada.snapshot || {}) };
  delete s.compartidoCon; delete s.permisos; // colaboradores no vuelven
  await setDoc(doc(db, 'proyectos', String(entrada.idOriginal)), s);
  // Hijos agrupados
  const qs = await getDocs(query(collection(db, 'papelera'), where('uid', '==', uid), where('meta.grupo', '==', String(entrada.idOriginal))));
  let hijos = 0;
  for (const d of qs.docs) {
    const h = { id: d.id, ...d.data() };
    try {
      await setDoc(doc(db, h.coleccionOriginal || 'puntos', String(h.idOriginal)), h.snapshot || {});
      await deleteDoc(doc(db, 'papelera', h.id));
      hijos++;
    } catch (e) { console.error('hijo no restaurado:', h.idOriginal, e); }
  }
  await quitarDePapelera(entrada.id);
  return { ok: true, hijos };
};
