import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const logError = async ({ mensaje, stack, contexto = '', uid = null, email = null }) => {
  try {
    await addDoc(collection(db, 'errores'), {
      uid,
      email,
      mensaje: String(mensaje).slice(0, 500),
      stack: String(stack || '').slice(0, 3000),
      contexto: contexto || '',
      dispositivo: navigator.userAgent,
      fecha: new Date().toISOString(),
    });
  } catch (_) { /* never throw */ }
};
