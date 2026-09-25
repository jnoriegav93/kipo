// Prueba con toques (jsdom + react-dom/client) de llevar armados con ferretería creada a
// mano, en la ventana real de la obra (VistaProyectos → ComparativoModal, pestaña
// Armados). Firestore y copiarMateriales son de mentira; la confirmación es la de la app
// (setConfirmData), y la prueba "toca" AGREGAR o CANCELAR llamando a lo que recibió.
import { JSDOM } from 'jsdom';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const KIPO = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const SCR = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://kipo-d29af.web.app/', pretendToBeVisual: true });
const w = dom.window;
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event', 'localStorage', 'sessionStorage', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  try { globalThis[k] = k === 'window' ? w : w[k]; } catch { /* solo lectura */ }
}
Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true });
w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
globalThis.matchMedia = w.matchMedia;
class RO { observe() {} unobserve() {} disconnect() {} }
w.ResizeObserver = globalThis.ResizeObserver = RO;
w.IntersectionObserver = globalThis.IntersectionObserver = RO;
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const require = createRequire(`${KIPO}/package.json`);
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = React;
const { createServer } = await import(pathToFileURL(`${KIPO}/node_modules/vite/dist/node/index.js`).href);

const server = await createServer({
  root: KIPO, configFile: false, logLevel: 'error',
  server: { middlewareMode: true, hmr: false, fs: { allow: [KIPO, SCR] } }, appType: 'custom',
  optimizeDeps: { noDiscovery: true, entries: [] },
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: /^\.\.\/firebaseConfig$/, replacement: `${SCR}/stub-firebaseConfig.js` },
      { find: /^\.\/firebaseConfig$/, replacement: `${SCR}/stub-firebaseConfig.js` },
      { find: /^firebase\/firestore$/, replacement: `${SCR}/stub-firestore.js` },
      { find: /^\.\.\/services\/materiales$/, replacement: `${SCR}/stub-materiales.js` },
      { find: /^\.\.\/services\/exportacionService$/, replacement: `${SCR}/stub-exportacionService.js` },
      { find: /^\.\.\/components\/Mapas$/, replacement: `${SCR}/stub-Mapas.jsx` },
      { find: /^\.\/Mapas$/, replacement: `${SCR}/stub-Mapas.jsx` },
      { find: /^file-saver$/, replacement: `${SCR}/stub-file-saver.js` },
    ],
  },
});

const theme = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? `t-${k}` : undefined) });
const nada = () => {};
// Catálogos: Olga (dueña de P) no tiene f_e1 ni f_gone; Eva (editora) creó f_e1 a mano.
const CAT_OLGA = [{ id: 'b1', nombre: 'AISLADOR' }, { id: 'b9', nombre: 'CRUCETA OLGA' }];
const CAT_EVA = [{ id: 'b1', nombre: 'AISLADOR' }, { id: 'f_e1', nombre: 'CINTA EVA' }];
const MIO = { id: 'a_mio', nombre: 'MI ARMADO', items: [{ idRef: 'b1', cant: 1 }, { idRef: 'f_e1', cant: 2 }], visible: true };
const DE_OBRA = { id: 'a_obra', nombre: 'DE LA OBRA', items: [{ idRef: 'b1', cant: 1 }, { idRef: 'b9', cant: 1 }], visible: true };
const obra = { id: 'P', nombre: 'OBRA P', ownerId: 'O', ownerNombre: 'Olga', dias: [{ id: 'd1' }],
  miembros: { O: { rol: 'dueno' }, E: { rol: 'editor' } }, miembrosUids: ['O', 'E'], armados: [DE_OBRA] };

// Responde como el servidor: copia de Eva a Olga (desde 'mi') o de Olga a Eva (desde la obra)
const responder = ({ ids, desde }) => {
  const origen = desde === 'mi' ? CAT_EVA : CAT_OLGA;
  const de = new Map(origen.map(m => [m.id, m]));
  return { agregados: ids.filter(i => de.has(i)).map(i => ({ id: i, nombre: de.get(i).nombre })), sinOrigen: ids.filter(i => !de.has(i)) };
};

const { default: VistaProyectos } = await server.ssrLoadModule('/src/views/VistaProyectos.jsx');

const montar = async ({ usuario, config, docs }) => {
  globalThis.__fs = { docs: { ...docs }, escrituras: [] };
  globalThis.__materiales = [];
  globalThis.__responderMateriales = responder;
  const estado = { confirm: null, alertas: [] };
  const cont = document.createElement('div'); document.body.appendChild(cont);
  const root = createRoot(cont);
  const props = {
    theme, isDark: false, perfilActivo: 'claro', proyectos: [obra], proyectoActual: null, puntos: [], diasVisibles: ['d1'],
    config, vista: 'proyectos', setVista: nada, setTempData: nada, setModalOpen: nada, modalOpen: null,
    seleccionarProyecto: nada, diaActual: null, setDiaActual: nada, toggleVisibilidadDia: nada, cambiarColorDia: nada,
    uniformizarColorDias: nada, toggleVisibilidadProyecto: nada, cambiarColorProyecto: nada, solicitarBorrarProyecto: nada,
    irUbicacionProyecto: nada, setExportData: nada, selectorColorAbierto: null, setSelectorColorAbierto: nada, tempData: {},
    confirmarCrearProyecto: nada, confirmarCrearDia: nada, user: { uid: usuario, email: `${usuario}@x.com` },
    setAlertData: (a) => { if (a) estado.alertas.push(a); }, setConfirmData: (c) => { estado.confirm = c; },
    setPuntoSeleccionado: nada, setModoLectura: nada, setModoEdicion: nada, setDatosFormulario: nada, setVistaAnterior: nada,
    setMapViewState: nada, modalPendiente: 'COMPARATIVO_P', setModalPendiente: nada, setMostrarOverlayGPS: nada,
    onVolver: nada, conexiones: [], proyectosArchivados: [],
  };
  await act(async () => { root.render(React.createElement(VistaProyectos, props)); await new Promise(r => setTimeout(r, 20)); });
  const botones = () => [...cont.querySelectorAll('button')];
  const boton = (t) => botones().find(b => b.textContent.trim() === t);
  const tocar = async (b) => { await act(async () => { b.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await new Promise(r => setTimeout(r, 20)); }); };
  const responderConfirm = async (si) => { const c = estado.confirm; await act(async () => { (si ? c.onConfirm : c.onClose)(); await new Promise(r => setTimeout(r, 20)); }); };
  const cerrar = async () => { await act(async () => { root.unmount(); }); cont.remove(); };
  if (boton('Armados')) await tocar(boton('Armados'));
  return { cont, boton, botones, tocar, estado, responderConfirm, cerrar };
};

const fallas = [];
const revisar = (nombre, cond) => { if (!cond) fallas.push(nombre); console.log(`${cond ? '✓' : '✗'} ${nombre}`); };
const escrituras = () => globalThis.__fs.escrituras;
const llamadas = () => globalThis.__materiales;
const docsBase = { 'configuraciones/O': { catalogoFerreteria: CAT_OLGA } };

try {
  // 1) Eva (editora) FIJA su armado con un material creado a mano
  {
    const v = await montar({ usuario: 'E', config: { armados: [MIO], catalogoFerreteria: CAT_EVA }, docs: docsBase });
    revisar('abre la pestaña Armados, con FIJAR para su armado', !!v.boton('FIJAR'));
    revisar('el armado sin fijar muestra sus materiales con SU catálogo (no "no encontrado")', v.cont.textContent.includes('2 × CINTA EVA'));
    await v.tocar(v.boton('FIJAR'));
    revisar('FIJAR: primero simula en el servidor', JSON.stringify(llamadas()) === JSON.stringify([{ ids: ['f_e1'], desde: 'mi', hacia: { proyectoId: 'P' }, simular: true }]));
    revisar('FIJAR: pide confirmar, nombrando el material y a Olga', !!v.estado.confirm && v.estado.confirm.message.includes('El catálogo de Olga no tiene este material: CINTA EVA') && v.estado.confirm.actionText === 'AGREGAR');
    revisar('FIJAR: nada guardado antes de confirmar', escrituras().length === 0);
    await v.responderConfirm(true);
    revisar('FIJAR: al confirmar, copia de verdad', llamadas().length === 2 && llamadas()[1].simular === false);
    const w1 = escrituras().find(e => e.path === 'proyectos/P');
    revisar('FIJAR: y el armado queda en la obra, junto al que ya estaba', !!w1 && JSON.stringify(w1.data.armados.map(a => a.id)) === '["a_obra","a_mio"]');
    await v.cerrar();
  }
  // 2) IMPORTAR desde la colección, y CANCELAR
  {
    const v = await montar({ usuario: 'E', config: { armados: [MIO], catalogoFerreteria: CAT_EVA }, docs: docsBase });
    await v.tocar(v.boton('IMPORTAR'));
    await v.tocar(v.boton('DESDE CONFIGURACIÓN'));
    const item = v.botones().find(b => b.textContent.includes('MI ARMADO') && !b.disabled);
    if (item) await v.tocar(item);
    revisar('IMPORTAR: el botón cuenta 1 elegido', !!v.boton('IMPORTAR (1)'));
    await v.tocar(v.boton('IMPORTAR (1)'));
    revisar('IMPORTAR: pide confirmar', !!v.estado.confirm && v.estado.confirm.message.includes('CINTA EVA'));
    await v.responderConfirm(false);
    revisar('CANCELAR: no copia ni guarda nada', llamadas().filter(l => !l.simular).length === 0 && escrituras().length === 0);
    await v.cerrar();
  }
  // 3) IMPORTAR desde la colección, y AGREGAR
  {
    const v = await montar({ usuario: 'E', config: { armados: [MIO], catalogoFerreteria: CAT_EVA }, docs: docsBase });
    await v.tocar(v.boton('IMPORTAR'));
    await v.tocar(v.boton('DESDE CONFIGURACIÓN'));
    const item = v.botones().find(b => b.textContent.includes('MI ARMADO') && !b.disabled);
    if (item) await v.tocar(item);
    await v.tocar(v.boton('IMPORTAR (1)'));
    await v.responderConfirm(true);
    const w3 = escrituras().find(e => e.path === 'proyectos/P');
    revisar('IMPORTAR + AGREGAR: copia y guarda el armado en la obra', llamadas().filter(l => !l.simular).length === 1 && !!w3 && w3.data.armados.some(a => a.id === 'a_mio'));
    await v.cerrar();
  }
  // 4) CONSERVAR en su colección un armado de la obra de Olga (usa CRUCETA OLGA)
  {
    const v = await montar({ usuario: 'E', config: { armados: [MIO], catalogoFerreteria: CAT_EVA }, docs: docsBase });
    await v.tocar(v.boton('CONSERVAR'));
    revisar('CONSERVAR: simula desde la obra hacia su catálogo', JSON.stringify(llamadas()[0]) === JSON.stringify({ ids: ['b9'], desde: { proyectoId: 'P' }, hacia: 'mi', simular: true }));
    revisar('CONSERVAR: "Tu catálogo no tiene este material: CRUCETA OLGA"', !!v.estado.confirm && v.estado.confirm.message.includes('Tu catálogo no tiene este material: CRUCETA OLGA'));
    await v.responderConfirm(true);
    const w4 = escrituras().find(e => e.path === 'configuraciones/E');
    revisar('CONSERVAR: y el armado queda en su colección', !!w4 && w4.data.armados.some(a => a.id === 'a_obra'));
    await v.cerrar();
  }
  // 5) La dueña, en su obra, FIJA un armado con un material que ya no existe: como antes
  {
    const MIO_O = { id: 'a_olga', nombre: 'ARMADO VIEJO', items: [{ idRef: 'f_gone', cant: 1 }], visible: true };
    const v = await montar({ usuario: 'O', config: { armados: [MIO_O], catalogoFerreteria: CAT_OLGA }, docs: docsBase });
    await v.tocar(v.boton('FIJAR'));
    revisar('dueña, mismo catálogo: sin servidor', llamadas().length === 0);
    revisar('dueña: avisa que no se llevó y no guarda', v.estado.alertas.some(a => /no se llev/.test(a.title)) && escrituras().length === 0);
    await v.cerrar();
  }
} catch (e) {
  fallas.push(`se cayó: ${e.stack || e}`);
  console.log('✗ se cayó:', e);
} finally {
  await server.close();
}
console.log(fallas.length ? `RESULTADO: MAL (${fallas.length})` : 'RESULTADO: OK');
process.exit(fallas.length ? 1 : 0);
