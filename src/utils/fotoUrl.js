import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';

// Descarga el blob de una foto para compartir/estampar.
// Si la URL guardada falla (403 por token viejo tras una re-subida o restauración),
// pide una URL fresca a Storage usando el _path guardado y reintenta.
export const fetchFotoBlob = async (foto) => {
  const url = typeof foto === 'string' ? foto : foto?.url;
  const paths = (foto && typeof foto === 'object')
    ? [foto._pathHD, foto._path].filter(Boolean)
    : [];

  if (url) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.blob();
    } catch { /* reintenta con URL fresca */ }
  }

  for (const p of paths) {
    try {
      const fresca = await getDownloadURL(ref(storage, p));
      const r = await fetch(fresca);
      if (r.ok) return await r.blob();
    } catch { /* prueba el siguiente path */ }
  }

  // Último recurso: la miniatura (puede ser base64 local)
  const thumb = (foto && typeof foto === 'object') ? foto.thumb : null;
  if (thumb) {
    try {
      const r = await fetch(thumb);
      if (r.ok) return await r.blob();
    } catch { /* sin opciones */ }
  }
  console.warn('fetchFotoBlob: no se pudo obtener la foto', url || paths[0] || '(sin url)');
  return null;
};
