import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const SIN_CABLES = [];

// Cables de acero de UN proyecto, los haya dibujado quien sea. Para liquidar hacen
// falta todos: el listener del mapa solo trae los del propio usuario.
export const useCablesAceroProyecto = (proyectoId) => {
  const [leidos, setLeidos] = useState({ proyectoId: null, cables: SIN_CABLES });

  useEffect(() => {
    if (!proyectoId) return;
    const q = query(collection(db, 'cablesAcero'), where('proyectoId', '==', String(proyectoId)));
    return onSnapshot(q,
      (snap) => setLeidos({ proyectoId: String(proyectoId), cables: snap.docs.map(d => ({ ...d.data(), id: d.id })) }),
      (e) => console.error('Error leyendo los cables de acero del proyecto:', e));
  }, [proyectoId]);

  // Mientras llegan los del proyecto pedido no se muestran los de otro anterior
  return proyectoId && leidos.proyectoId === String(proyectoId) ? leidos.cables : SIN_CABLES;
};
