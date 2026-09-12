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
 * Llama a la Cloud Function 'auditarFotosHuerfanas' (solo admin, solo lectura).
 * Retorna { totalArchivos, totalHuerfanas, bytesHuerfanas, huerfanas: [...] }.
 */
export const auditarFotosHuerfanas = async (proyectoId) => {
  const fn = httpsCallable(functions, 'auditarFotosHuerfanas', { timeout: 300000 });
  const result = await fn({ proyectoId });
  return result.data;
};

/**
 * Llama a 'clasificarFotosProyecto': clasifica cada foto por PESO real
 * (buena vs miniatura). Retorna { umbralBytes, totalPostes, postes: [...] }.
 */
export const clasificarFotosProyecto = async (proyectoId) => {
  const fn = httpsCallable(functions, 'clasificarFotosProyecto', { timeout: 300000 });
  const result = await fn({ proyectoId });
  return result.data;
};

/**
 * Llama a 'respaldarFotosExistentes': copia al espejo respaldo/ las fotos del
 * proyecto subidas ANTES de activar el respaldo automático. Idempotente.
 * Retorna { copiadas, yaExistian, errores }.
 */
export const respaldarFotosExistentes = async (proyectoId) => {
  const fn = httpsCallable(functions, 'respaldarFotosExistentes', { timeout: 540000 });
  const result = await fn({ proyectoId });
  return result.data;
};

/**
 * Verifica un LOTE de puntos contra Storage: nube / caída / respaldo por foto.
 * (El estado "equipo" lo cruza el cliente con IndexedDB.) Retorna { puntos: [...] }.
 */
export const verificarFotosProyecto = async (proyectoId, puntoIds) => {
  const fn = httpsCallable(functions, 'verificarFotosProyecto', { timeout: 300000 });
  const result = await fn({ proyectoId, puntoIds });
  return result.data;
};

/**
 * Independiza las fotos de puntos copiados/pasados a otro proyecto: copia los archivos
 * a la carpeta del proyecto destino y re-vincula las URLs. Retorna { copiadas, errores }.
 */
export const independizarFotosPuntos = async (puntoIds, proyectoDestino) => {
  const fn = httpsCallable(functions, 'independizarFotosPuntos', { timeout: 540000 });
  const result = await fn({ puntoIds, proyectoDestino });
  return result.data;
};

/**
 * Restaura archivos CAÍDOS copiando desde respaldo/{path}. Retorna { resultados }.
 */
export const repararDesdeRespaldo = async (paths) => {
  const fn = httpsCallable(functions, 'repararDesdeRespaldo', { timeout: 540000 });
  const result = await fn({ paths });
  return result.data;
};

/**
 * Reparación COMPLETA en el servidor (backfill respaldo + restaurar caídas +
 * re-vincular URLs). Una vez invocada, el servidor la TERMINA aunque la app se
 * cierre. Retorna { respaldadas, restauradas, sinFuente }.
 */
export const repararFotosServidor = async (proyectoId) => {
  const fn = httpsCallable(functions, 'repararFotosServidor', { timeout: 540000 });
  const result = await fn({ proyectoId });
  return result.data;
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
