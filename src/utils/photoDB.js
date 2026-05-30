const DB_NAME = 'kipo_photos';
const STORE = 'pending_uploads';

const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'path' });
  req.onsuccess = e => resolve(e.target.result);
  req.onerror = () => reject(req.error);
});

export const saveUploadPending = async (entry) => {
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ ...entry, ts: Date.now() });
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch {}
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
