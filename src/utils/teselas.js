// Política de teselas del mapa: cuándo reintentar una que falló y cuánta caché
// guardar según el equipo. Aquí va solo la decisión (pura, probable con Node); el
// efecto sobre el DOM y sobre la Cache Storage vive abajo, aislado.

// ── REINTENTO ────────────────────────────────────────────────────────────────
// Una tesela que falla se quedaba en blanco PARA SIEMPRE: Leaflet no vuelve a
// pedirla sola, y el hueco solo se rellenaba si el usuario se alejaba y volvía.
// Con internet lento el fallo casi nunca es "no existe", es "se cortó": por eso
// vale la pena insistir, pero pocas veces y espaciando, para no empeorar el
// atasco que causó el fallo.
export const MAX_INTENTOS = 3;
const ESPERAS = [400, 1200, 2500];

export const esperaReintento = (intento) => {
  const i = Math.min(Math.max(Number(intento) || 0, 0), ESPERAS.length - 1);
  return ESPERAS[i];
};

// Sin conexión NO se reintenta: si se cayó el internet fallan todas a la vez y
// reintentarlas multiplicaría por cuatro una ráfaga que ya no va a funcionar.
export const debeReintentar = ({ intento, enLinea = true }) =>
  !!enLinea && (Number(intento) || 0) < MAX_INTENTOS;

// ── TAMAÑO DE LA CACHÉ ───────────────────────────────────────────────────────
// El tope del service worker se hornea al compilar y el mismo SW atiende al
// celular y a la PC, así que el tope grande se declara para todos (vite.config)
// y en el celular la app recorta hasta el tope chico.
//
// Cuánto ocupa esto de verdad: MEDIDO, una tesela pesa ~4 KB, así que 6000 son
// unos 34 MB. Nada. El tope chico del celular es prudencia, no necesidad.
//
// Ojo con lo que costó averiguar: eso vale mientras las teselas se pidan CON CORS
// (`crossOrigin` en las capas de Mapas.jsx). Pedidas sin CORS llegan como
// respuestas opacas, y Chrome las contabiliza acolchadas a ~8 MB CADA UNA. Con
// eso el uso reportado superaba el 80% siempre y `purgaAdaptativa` (photoDB.js)
// borraba las cachés de mapas enteras en cada arranque. Si alguna capa vuelve a
// pedirlas sin CORS, estos topes dejan de significar lo que dicen.
export const CACHE_TESELAS = 'tiles-google';
export const TOPE_PC = 6000;
export const TOPE_MOVIL = 2000;
export const topeTeselas = (esPC) => (esPC ? TOPE_PC : TOPE_MOVIL);

export const sobranDeCache = (total, tope) => Math.max(0, (Number(total) || 0) - (Number(tope) || 0));

// Revisar en cada tesela costaría un recorrido de miles de claves por tesela.
// Se revisa cada tanto, que es cuando la caché pudo crecer de verdad.
export const REVISAR_CADA = 300;
export const tocaRevisar = (cargadas, cada = REVISAR_CADA) => {
  const n = Number(cargadas) || 0;
  const c = Number(cada) || 0;
  return n > 0 && c > 0 && n % c === 0;
};

// ── EFECTO ───────────────────────────────────────────────────────────────────
// Recorta la caché de teselas a `tope`, borrando las más viejas. `cache.keys()`
// las devuelve en orden de inserción, así que las primeras son las más viejas.
//
// Borrar por fuera del plugin de expiración del SW es seguro: ese plugin guarda
// su propia lista en IndexedDB y, cuando le toque limpiar, pedirá borrar URLs
// que ya no están. Eso no falla, simplemente no hace nada.
let recortando = false;
export const recortarCacheTeselas = async (tope, nombre = CACHE_TESELAS) => {
  if (recortando) return 0;
  recortando = true;
  try {
    if (typeof caches === 'undefined') return 0;
    const cache = await caches.open(nombre);
    const claves = await cache.keys();
    const sobran = sobranDeCache(claves.length, tope);
    if (!sobran) return 0;
    for (let i = 0; i < sobran; i++) await cache.delete(claves[i]);
    return sobran;
  } catch {
    return 0;
  } finally {
    recortando = false;
  }
};
