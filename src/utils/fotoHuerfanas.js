// Registro liviano (localStorage) de fotos que se subieron pero cuyo punto
// puede no haberse guardado. Si tras un reinicio siguen acá (no se limpiaron al
// guardar el punto), se promueven a la capa de fotos del mapa (fotosProyecto).
// Solo guarda metadata (url, thumb, coords) — nunca blobs.

const KEY = 'kipo_foto_huerfanas';

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch {} };

export const registrarCandidata = (entry) => {
  const id = `h_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const l = read();
  l.push({ id, ...entry, ts: Date.now() });
  write(l);
  return id;
};

export const quitarCandidata = (id) => write(read().filter(c => c.id !== id));

// Quita candidatas cuya foto (url) ya quedó guardada en el punto. Más confiable
// que por puntoId, porque el id temporal de fotos y el id final del punto difieren.
export const quitarCandidatasPorUrls = (urls) => {
  if (!urls || urls.length === 0) return;
  const set = new Set(urls);
  write(read().filter(c => !set.has(c.url)));
};

export const getCandidatas = () => read();
