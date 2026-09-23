import { collection, doc, getDoc, setDoc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '../firebaseConfig';

// Invitaciones a un proyecto (paso 3a del rediseño de equipos; CONTEXTO.md, "Invitar").
// El código es el id del documento: largo y al azar, lo da Firestore. El link y el QR
// llevan SOLO ese código; el proyecto y el rol viven aquí.

// Crea una invitación. `tipo`: 'link' sirve una vez; 'qr' sirve mientras esté abierto.
// Las reglas exigen que quien invita sea el dueño del proyecto.
export const crearInvitacion = async ({ proyecto, rol, tipo, user, config }) => {
  const ref = doc(collection(db, 'invitaciones'));
  const invitacion = {
    proyectoId: String(proyecto.id),
    proyectoNombre: proyecto.nombre || '',
    rol,
    tipo,
    deUid: user.uid,
    deNombre: config?.nombrePersonal || user.email?.split('@')[0] || '',
    creada: new Date().toISOString(),
    estado: 'abierta',
  };
  await setDoc(ref, invitacion);
  return { codigo: ref.id, ...invitacion };
};

// Anula un link o cierra un QR. Solo quien la creó puede hacerlo.
export const anularInvitacion = (codigo, estado = 'anulada') =>
  updateDoc(doc(db, 'invitaciones', codigo), { estado, anuladaEn: new Date().toISOString() });

export const leerInvitacion = async (codigo) => {
  const snap = await getDoc(doc(db, 'invitaciones', codigo));
  return snap.exists() ? snap.data() : null;
};

// Aceptar lo hace el servidor (`aceptarInvitacion`, en functions/index.js): valida el
// código, suma al miembro y gasta el link, todo junto. Si la invitación no sirve, el
// error trae en `message` su estado: 'inexistente', 'usada', 'anulada' o 'vencida'.
export const aceptarInvitacion = async (codigo) => {
  const fn = httpsCallable(getFunctions(app, 'us-central1'), 'aceptarInvitacion');
  return (await fn({ codigo })).data;
};

// Las invitaciones sin usar de un proyecto, de quien las creó.
export const escucharInvitacionesAbiertas = (proyectoId, uid, alCambiar) => onSnapshot(
  query(collection(db, 'invitaciones'),
    where('deUid', '==', uid),
    where('proyectoId', '==', String(proyectoId)),
    where('estado', '==', 'abierta')),
  (snap) => alCambiar(snap.docs.map(d => ({ codigo: d.id, ...d.data() }))),
  (error) => { console.error('Invitaciones sin usar:', error); alCambiar([]); }
);
