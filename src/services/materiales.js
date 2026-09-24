import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';

// Copia materiales de ferretería de un catálogo a otro con la función `copiarMateriales`
// (functions/index.js): el destino puede ser el catálogo de otra persona, que solo escribe
// el servidor. desde / hacia: 'mi' o { proyectoId } (el catálogo del dueño de esa obra).
// Con `simular` devuelve lo que se copiaría sin escribir.
// Responde { agregados: [{ id, nombre }], sinOrigen: [ids] }.
export const copiarMateriales = async ({ ids, desde, hacia, simular = false }) => {
  const fn = httpsCallable(getFunctions(app, 'us-central1'), 'copiarMateriales');
  return (await fn({ ids, desde, hacia, simular })).data;
};
