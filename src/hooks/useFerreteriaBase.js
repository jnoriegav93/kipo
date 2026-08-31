// Ferretería BASE global (una sola para todos), gestionada por el admin.
// Vive en Firestore: sistema/ferreteriaBase { items: [{id, nombre, codigo, detalle}] }.
// En la app solo se muestra `nombre`; codigo/detalle quedan internos.
import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const REF = () => doc(db, 'sistema', 'ferreteriaBase');

export function useFerreteriaBase() {
  const [items, setItems] = useState([]);
  const [cargado, setCargado] = useState(false);
  useEffect(() => {
    const unsub = onSnapshot(REF(), (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setItems(Array.isArray(data?.items) ? data.items : []);
      setCargado(true);
    }, () => setCargado(true));
    return unsub;
  }, []);
  return { ferreteriaBase: items, ferreteriaBaseCargada: cargado };
}

// Guarda la lista completa de base (solo el admin puede por reglas de Firestore).
export async function guardarFerreteriaBase(items) {
  await setDoc(REF(), { items, actualizado: Date.now() }, { merge: true });
}
