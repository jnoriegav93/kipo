const DB_NAME = 'kipo_photos';
const STORE = 'pending_uploads';

const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'path' });
  req.onsuccess = e => resolve(e.target.result);
  req.onerror = () => reject(req.error);
});

const putEntry = async (entry) => {
  const db = await openDB();
  try {
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ ...entry, ts: Date.now() });
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } finally { db.close(); }
};

export const saveUploadPending = async (entry) => {
  try {
    await putEntry(entry);
  } catch (e) {
    // VÁLVULA DE CAPTURA: si no hay espacio, libera respaldos YA SUBIDOS (viejos primero,
    // ~300 MB) y reintenta UNA vez. La foto nueva tiene prioridad sobre los respaldos.
    try {
      const resp = (await getRespaldosSubidos()).sort((a, b) => a.subidaEn - b.subidaEn);
      let lib = 0;
      for (const r of resp) {
        if (lib >= 300 * 1048576) break;
        await deleteUploadPending(r.path);
        lib += r.bytes;
      }
      console.warn('Válvula de espacio: liberados', Math.round(lib / 1048576), 'MB de respaldos para guardar la foto.');
      await putEntry(entry);
    } catch (e2) { console.error('saveUploadPending sin espacio:', e2); }
  }
};

export const deleteUploadPending = async (path) => {
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(path);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch {}
};

// Tras subir con éxito: en vez de borrar el blob, lo CONSERVA como respaldo local
// (marcado subida:true) para poder re-subir/verificar hasta 30 días. Los blobs PESADOS
// (originales de alta calidad) NO se conservan — ocupan mucho y llenarían el equipo.
export const marcarSubida = async (path) => {
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.get(path);
      req.onsuccess = () => {
        const e = req.result;
        if (!e) { res(); return; }
        if (e.pesado) store.delete(path);                       // original pesado → no se conserva
        else store.put({ ...e, subida: true, subidaEn: Date.now() }); // comprimida → respaldo local
      };
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch {}
};

// Limpia los blobs YA SUBIDOS con más de `dias` días (respaldo local expirado).
export const limpiarBlobsVencidos = async (dias = 30) => {
  try {
    const corte = Date.now() - dias * 24 * 60 * 60 * 1000;
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        (req.result || []).forEach(e => { if (e.subida && (e.subidaEn || 0) < corte) store.delete(e.path); });
      };
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch {}
};

// Devuelve UNA entrada pendiente (con su blob) por su path, o null.
export const getUploadPending = async (path) => {
  try {
    const db = await openDB();
    const result = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(path);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
};

export const getAllUploadsPending = async () => {
  try {
    const db = await openDB();
    const result = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return result || [];
  } catch {
    return [];
  }
};

// ── Respaldos YA SUBIDOS a la nube (marcados al confirmar la subida) ──────────
// Devuelve path, tamaño, fecha y proyecto (extraído del path proyectos/{id}/...).
export const getRespaldosSubidos = async () => {
  const todos = await getAllUploadsPending();
  return todos
    .filter(e => e.subida && e.blob)
    .map(e => ({
      path: e.path,
      bytes: e.blob?.size || 0,
      subidaEn: e.subidaEn || e.ts || 0,
      proyectoId: (String(e.path).match(/^proyectos\/([^/]+)\//) || [])[1] || 'otros',
    }));
};

export const liberarRespaldos = async (paths) => {
  let n = 0;
  for (const p of paths) { await deleteUploadPending(p); n++; }
  return n;
};

// ── PURGA ADAPTATIVA ──────────────────────────────────────────────────────────
// Si el uso pasa el umbral (80% de la cuota), libera: (1) cachés de mapas
// (re-descargables) y (2) respaldos YA SUBIDOS del más viejo al más nuevo hasta
// bajar al objetivo (70%). Las fotos PENDIENTES nunca se tocan. Los 30 días de
// respaldo se respetan mientras haya espacio; el espacio para capturar es primero.
export const purgaAdaptativa = async (umbral = 0.8, objetivo = 0.7) => {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est?.quota) return null;
    if ((est.usage / est.quota) < umbral) return null;
    let tiles = 0;
    for (const c of ['tiles-esri', 'tiles-google', 'tiles-carto']) {
      try { if (await caches.delete(c)) tiles++; } catch { /* sin Cache API */ }
    }
    const aLiberar = est.usage - est.quota * objetivo;
    const resp = (await getRespaldosSubidos()).sort((a, b) => a.subidaEn - b.subidaEn);
    let liberado = 0, borrados = 0;
    for (const r of resp) {
      if (liberado >= aLiberar) break;
      await deleteUploadPending(r.path);
      liberado += r.bytes; borrados++;
    }
    console.log(`Purga adaptativa: ${tiles} cachés de mapas + ${borrados} respaldos (${Math.round(liberado / 1048576)} MB).`);
    return { tiles, borrados, liberadoMB: Math.round(liberado / 1048576) };
  } catch { return null; }
};
