// CABLE DE ACERO (mensajero): va de poste a poste, sostiene la fibra en los cambios
// de dirección y se liquida como ferretería, por metro. No es fibra: vive en su
// propia colección (cablesAcero) para que nada de lo que lee fibras lo cuente.
//
// Un cable guarda sus dos postes, su tipo, las fibras que se apoyan en él y el medio
// tramo donde se apoyan. El largo se calcula siempre con la posición actual de los
// postes: si uno se corrige, los metros también.
import { distanciaMetros } from './fibraUtils.js';

// Tipos fijos, como las capacidades de la fibra: no se agregan ni se quitan desde la
// app. El id es el ítem del catálogo base con el que se liquida.
export const TIPOS_CABLE_ACERO = [
  { id: 'b13', nombre: 'MENSAJERO 1/8', medida: '1/8' },
  { id: 'b38', nombre: 'MENSAJERO 3/16', medida: '3/16' },
];

// ¿Es cable de acero este ítem del catálogo? Se tiende en el mapa y se cuenta por
// metro, nunca como ferretería de un poste.
export const esCableAcero = (ferrId) => TIPOS_CABLE_ACERO.some(t => t.id === String(ferrId));
export const nombreTipoAcero = (ferrId) => TIPOS_CABLE_ACERO.find(t => t.id === String(ferrId))?.nombre || 'CABLE DE ACERO';

// Lo contado por poste, sin el cable de acero: ese nunca es ferretería del poste y sus
// metros salen solo de los cables trazados. Las cantidades que se cargaron por poste
// antes de existir el cable de acero dejan de sumar.
export const quitarCableAcero = (totales = {}) =>
  Object.fromEntries(Object.entries(totales).filter(([id]) => !esCableAcero(id)));

// Ferretería que se sugiere en los puntos de un cable de acero, según su tipo: en sus dos
// postes y en su medio tramo. Solo sugiere, sin cantidad, como las que "van juntas".
// Son ids del catálogo base.
export const SUGERIDAS_CABLE_ACERO = {
  b13: { postes: ['b12'], medioTramo: ['b15'] },  // 1/8: grillete tipo candado · chapa braquelita
  b38: { postes: ['b40'], medioTramo: ['b37'] },  // 3/16: preformado rojo 3/16 · chapa 3 huecos
};

// Qué sugieren los cables de acero en un punto: lo de sus postes si el punto es una de sus
// puntas y lo de su medio tramo si es donde se apoyan las fibras. Devuelve
// { ferrId: 'ACERO 1/8' }, con el tipo que lo sugiere para mostrar el motivo.
export const sugeridasPorAcero = (puntoId, cables = []) => {
  const sugeridas = {};
  if (puntoId == null) return sugeridas;
  const id = String(puntoId);
  cables.forEach(c => {
    const regla = SUGERIDAS_CABLE_ACERO[c.ferrId];
    if (!regla) return;
    const motivo = `ACERO ${TIPOS_CABLE_ACERO.find(t => t.id === c.ferrId).medida}`;
    [
      ...((c.puntos || []).map(String).includes(id) ? regla.postes : []),
      ...(c.medioTramo != null && String(c.medioTramo) === id ? regla.medioTramo : []),
    ].forEach(ferrId => { if (!sugeridas[ferrId]) sugeridas[ferrId] = motivo; });
  });
  return sugeridas;
};

// Se liquida la distancia entre postes más un metro, redondeado al metro superior
export const METRO_EXTRA_ACERO = 1;

export const metrosCableAcero = (a, b) => {
  const d = distanciaMetros(a, b) + METRO_EXTRA_ACERO;
  // Al centímetro antes de subir: el ruido de la coma flotante no debe sumar un metro
  return Math.ceil(Math.round(d * 100) / 100);
};

// Medio tramo: se reconoce por su tipo de elemento, igual que en el mapa
export const esMedioTramo = (punto) => {
  const te = punto?.datos?.tipoElemento;
  return (Array.isArray(te) ? te : (te ? [te] : [])).includes('medioTramo');
};

// ── Trazo en curso ──────────────────────────────────────────────────────────
// Lo que se va tocando antes de guardar, con los ids como texto. `id` y `ferrId`
// solo vienen al editar un cable ya guardado.
export const TRAZO_ACERO_VACIO = { id: null, ferrId: null, postes: [], fibras: [], medioTramo: null };

export const hayTrazoAcero = (t) => t.postes.length > 0 || t.fibras.length > 0 || t.medioTramo != null;

// Tocar un punto. El medio tramo es donde se apoyan las fibras: tocar otro lo cambia y
// tocar el mismo lo suelta. Cualquier otro punto es poste: van dos, y un tercero
// cambia el segundo, que es donde suele estar el error.
export const tocarPuntoAcero = (trazo, puntoId, medioTramo) => {
  const id = String(puntoId);
  if (medioTramo) return { ...trazo, medioTramo: trazo.medioTramo === id ? null : id };
  if (trazo.postes.includes(id)) return trazo;
  return { ...trazo, postes: trazo.postes.length < 2 ? [...trazo.postes, id] : [trazo.postes[0], id] };
};

// Tocar una fibra la marca como apoyada en el cable, o la desmarca
export const tocarFibraAcero = (trazo, fibraId) => {
  const id = String(fibraId);
  return { ...trazo, fibras: trazo.fibras.includes(id) ? trazo.fibras.filter(f => f !== id) : [...trazo.fibras, id] };
};

// ATRÁS deshace en el orden inverso al que se pide: medio tramo, fibras y postes. Sin
// nada más que quitar, suelta también el cable que se estaba editando.
export const deshacerTrazoAcero = (trazo) => {
  if (trazo.medioTramo != null) return { ...trazo, medioTramo: null };
  if (trazo.fibras.length) return { ...trazo, fibras: trazo.fibras.slice(0, -1) };
  if (trazo.postes.length) return { ...trazo, postes: trazo.postes.slice(0, -1) };
  return TRAZO_ACERO_VACIO;
};

// Lo primero que falta por tocar, en el orden en que se pide; null si ya está todo. Es la
// guía de la barra: para GUARDAR basta con los dos postes (ver puedeGuardarAcero).
export const faltaEnTrazoAcero = (trazo) => {
  if (trazo.postes.length === 0) return 'poste1';
  if (trazo.postes.length === 1) return 'poste2';
  if (trazo.fibras.length === 0) return 'fibras';
  if (trazo.medioTramo == null) return 'medioTramo';
  return null;
};

// Con los dos postes ya se puede guardar: son los que dan los metros y los que sugieren
// su ferretería. Las fibras apoyadas y el medio tramo son opcionales; si faltan, la barra
// lo avisa antes de guardar y se completan después con EDITAR.
export const puedeGuardarAcero = (trazo) => trazo.postes.length === 2;

// Lo que quedaría sin marcar al guardar, para avisarlo: ['las fibras que se apoyan', …]
export const faltanOpcionalesAcero = (trazo) => [
  trazo.fibras.length === 0 ? 'las fibras que se apoyan' : null,
  trazo.medioTramo == null ? 'el medio tramo' : null,
].filter(Boolean);

// Un cable guardado, de vuelta a trazo para editarlo
export const trazoDesdeCable = (cable) => ({
  id: String(cable.id),
  ferrId: cable.ferrId || null,
  postes: (cable.puntos || []).map(String),
  fibras: (cable.fibras || []).map(String),
  medioTramo: cable.medioTramo != null ? String(cable.medioTramo) : null,
});

// Fibras apoyadas en un medio tramo: las marcadas en los cables de acero que lo usan.
// Una fibra marcada en dos cables del mismo medio tramo cuenta una vez. Ids como texto.
export const fibrasApoyadasEn = (puntoId, cables = []) => {
  const ids = new Set();
  cables.forEach(c => {
    if (c.medioTramo == null || String(c.medioTramo) !== String(puntoId)) return;
    (c.fibras || []).forEach(f => ids.add(String(f)));
  });
  return ids;
};

// Los dos postes de un cable, o null si alguno no está (borrado u oculto)
export const postesDeCable = (cable, porId) => {
  const [a, b] = (cable?.puntos || []).map(id => porId.get(String(id)));
  return a?.coords?.lat != null && b?.coords?.lat != null ? [a, b] : null;
};

// Para reportes de una fila por poste: los metros de cada cable van en UNO de sus dos
// postes, el que va después en el orden dado. Así cada cable cuenta una sola vez, como
// la distancia al poste anterior. Un cable con un poste fuera de la lista (rango del
// reporte) no entra. Devuelve { puntoId: { ferrId: metros } }.
export const metrosAceroPorPoste = (cables = [], puntosEnOrden = []) => {
  const posicion = new Map(puntosEnOrden.map((p, i) => [String(p.id), i]));
  const porId = new Map(puntosEnOrden.map(p => [String(p.id), p]));
  const resultado = {};
  cables.forEach(c => {
    const postes = postesDeCable(c, porId);
    if (!postes || !c.ferrId) return;
    const [a, b] = postes;
    const destino = String(posicion.get(String(a.id)) > posicion.get(String(b.id)) ? a.id : b.id);
    const t = resultado[destino] || (resultado[destino] = {});
    t[c.ferrId] = (t[c.ferrId] || 0) + metrosCableAcero(a.coords, b.coords);
  });
  return resultado;
};

// Metros a liquidar por ítem del catálogo: { ferrId: metros }
export const metrosPorItem = (cables = [], puntos = []) => {
  const porId = new Map(puntos.map(p => [String(p.id), p]));
  const total = {};
  cables.forEach(c => {
    const postes = postesDeCable(c, porId);
    if (!postes || !c.ferrId) return;
    total[c.ferrId] = (total[c.ferrId] || 0) + metrosCableAcero(postes[0].coords, postes[1].coords);
  });
  return total;
};
