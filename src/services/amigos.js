import { collection, doc, setDoc, updateDoc, deleteDoc, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { idAmistad } from '../utils/amigos';

// Amigos y avisos (paso 3b del rediseño de equipos; CONTEXTO.md, "Amigos").

export const escucharAmistades = (uid, alCambiar) => onSnapshot(
  query(collection(db, 'amistades'), where('uids', 'array-contains', String(uid))),
  (snap) => alCambiar(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
  (error) => { console.error('Amistades:', error); alCambiar([]); }
);

// Solicitud de amistad: un documento por pareja (id fijo, ver `idAmistad`), pendiente
// hasta que el otro la acepte.
export const enviarSolicitud = ({ yo, miNombre, otro, otroNombre }) =>
  setDoc(doc(db, 'amistades', idAmistad(yo, otro)), {
    uids: [String(yo), String(otro)].sort(),
    de: String(yo),
    para: String(otro),
    estado: 'pendiente',
    creada: new Date().toISOString(),
    nombres: { [String(yo)]: miNombre || '', [String(otro)]: otroNombre || '' },
  });

// Aceptarla solo puede quien la recibió: lo exigen las reglas.
export const aceptarSolicitud = ({ id, yo, miNombre }) =>
  updateDoc(doc(db, 'amistades', id), {
    estado: 'aceptada',
    aceptadaEn: new Date().toISOString(),
    [`nombres.${yo}`]: miNombre || '',
  });

// Rechazar, cancelar o dejar de ser amigos: se borra el documento, para los dos.
export const borrarAmistad = (id) => deleteDoc(doc(db, 'amistades', id));

// Aviso para quien fue agregado directo a un proyecto: lo ve a pantalla completa al
// abrir Kipo. Solo lo puede crear el dueño del proyecto: lo exigen las reglas.
export const avisarAgregado = ({ para, proyecto, rol, deUid, deNombre }) =>
  addDoc(collection(db, 'avisos'), {
    para: String(para),
    tipo: 'agregado',
    proyectoId: String(proyecto.id),
    proyectoNombre: proyecto.nombre || '',
    rol,
    deUid: String(deUid),
    deNombre: deNombre || '',
    creado: new Date().toISOString(),
    visto: false,
  });

export const escucharAvisos = (uid, alCambiar) => onSnapshot(
  query(collection(db, 'avisos'), where('para', '==', String(uid)), where('visto', '==', false)),
  (snap) => alCambiar(snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.creado || '').localeCompare(b.creado || ''))),
  (error) => { console.error('Avisos:', error); alCambiar([]); }
);

export const marcarAvisosVistos = (ids) => Promise.all(ids.map(id =>
  updateDoc(doc(db, 'avisos', id), { visto: true, vistoEn: new Date().toISOString() })));
