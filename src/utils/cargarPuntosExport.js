// Fuente de puntos para los reportes de DATOS (excel). Carga TODOS los puntos del
// proyecto directamente de Firestore (fuente completa y fresca) y los une con los que
// ya haya en memoria (por si alguno se creó/editó offline y aún no sincronizó).
// Si la consulta falla (offline), cae a los puntos en memoria del proyecto.
//
// Motivo: el array `puntos` en memoria solo trae los del dueño (ownerId == uid) y
// depende de que la suscripción esté cargada; un proyecto compartido o recién abierto
// puede llegar incompleto. Consultar por proyectoId evita que falten datos.
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export async function cargarPuntosProyecto(proyecto, puntosEnMemoria = []) {
  const enMemProyecto = (puntosEnMemoria || []).filter(p => p && p.proyectoId === proyecto?.id);
  if (!proyecto?.id) return enMemProyecto;
  try {
    const snap = await getDocs(query(collection(db, 'puntos'), where('proyectoId', '==', proyecto.id)));
    // IMPORTANTE: el `id` SIEMPRE es la clave del documento, no un campo `id` que pueda
    // venir guardado (y desactualizado) dentro de la data. Por eso el spread va PRIMERO
    // y `id: d.id` al final (igual que useFirebaseData). Si se hiciera al revés, un `id`
    // interno distinto rompía la deduplicación y el punto entraba dos veces (Firestore + memoria).
    const remotos = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    // Unión: base remota (verdad persistida) + los de memoria que aún no estén en remoto.
    const idsRemotos = new Set(remotos.map(p => String(p.id)));
    const soloMemoria = enMemProyecto.filter(p => !idsRemotos.has(String(p.id)));
    // Defensa final: nunca devolver el mismo id dos veces, pase lo que pase.
    const vistos = new Set();
    return [...remotos, ...soloMemoria].filter(p => {
      const id = String(p?.id);
      if (!p || vistos.has(id)) return false;
      vistos.add(id);
      return true;
    });
  } catch (e) {
    console.warn('Export: no se pudo leer puntos de Firestore, uso memoria', e);
    return enMemProyecto;
  }
}
