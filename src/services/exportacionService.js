import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { app, db } from '../firebaseConfig';

// Instancia única de Functions (us-central1, misma región que la Cloud Function)
const functions = getFunctions(app, 'us-central1');

/**
 * Llama a la Cloud Function 'crearExportacion' y retorna el exportId.
 * La función crea el job en Firestore y lo procesa en segundo plano.
 */
export const crearExportacion = async (proyectoId, tipo, limiteFotos, stampConfig) => {
  const fn = httpsCallable(functions, 'crearExportacion');
  const result = await fn({ proyectoId, tipo, limiteFotos, stampConfig });
  return result.data.exportId;
};

/**
 * Suscribe a los cambios del documento de exportación en Firestore.
 * Llama a onUpdate(data) cada vez que cambia el status.
 * Retorna la función de cancelación (unsubscribe).
 */
export const suscribirseAExportacion = (exportId, onUpdate) => {
  const exportRef = doc(db, 'exportaciones', exportId);
  return onSnapshot(exportRef, (snap) => {
    if (snap.exists()) onUpdate(snap.data());
  });
};
