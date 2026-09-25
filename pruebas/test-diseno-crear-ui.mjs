// Prueba con toques (jsdom) de crear un proyecto desde el modo Diseño (24/09).
// Monta la VistaDiseno real con el crearProyectoDiseno real (useProjectLogic) sobre la
// Firestore de mentira de stub-firestore-vivo.js, que anota en orden lo que se escribe y
// lo que se escucha.
//
// Lo que se prueba:
// - El proyecto se abre en el acto, aunque el servidor no conteste nunca (sin señal).
// - El orden: primero sale el proyecto, después su catastro vacío y recién después se
//   escucha el catastro. Firestore aplica las escrituras de un equipo en ese orden (la
//   regla del diseño lee el proyecto), y la escucha encuentra el catastro en el equipo.
// - Si el servidor rechaza el proyecto, se vuelve a la lista con el formulario y el aviso.
// - Los postes por proyecto de la lista (contarPorProyecto) dan lo mismo que filtrar con
//   perteneceAProyecto.
//
// Control: con la ruta de otra versión de la vista, lo del proyecto sin señal TIENE que
// fallar (la de antes esperaba al servidor).
import { JSDOM } from 'jsdom';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const KIPO = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const AQUI = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const MODULO = process.argv[2] || '/src/views/VistaDiseno.jsx';
const LOGICA = process.argv[3] || '/src/hooks/useProjectLogic.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://kipo-d29af.web.app/', pretendToBeVisual: true });
const w = dom.window;
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event', 'localStorage', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  try { globalThis[k] = k === 'window' ? w : w[k]; } catch { /* solo lectura */ }
}
Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true });
for (const k of Object.getOwnPropertyNames(w)) {
  if (/^(HTML|SVG)\w*Element$/.test(k) && !(k in globalThis)) globalThis[k] = w[k];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(w, 'innerWidth', { value: 390, configurable: true });  // celular vertical
Object.defineProperty(w, 'innerHeight', { value: 844, configurable: true });

const require = createRequire(`${KIPO}/package.json`);
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = React;
const { createServer } = await import(pathToFileURL(`${KIPO}/node_modules/vite/dist/node/index.js`).href);
const server = await createServer({
  root: KIPO, configFile: false, logLevel: 'error',
  server: { middlewareMode: true, hmr: false, fs: { allow: [KIPO] } }, appType: 'custom',
  optimizeDeps: { noDiscovery: true, entries: [] },
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: /^\.\.\/firebaseConfig$/, replacement: `${AQUI}/stub-firebaseConfig-vivo.js` },
      { find: /^firebase\/firestore$/, replacement: `${AQUI}/stub-firestore-vivo.js` },
      { find: /^react-leaflet$/, replacement: `${AQUI}/stub-react-leaflet.jsx` },
      { find: /^leaflet\/dist\/leaflet\.css$/, replacement: `${AQUI}/stub-vacio.js` },
      { find: /^file-saver$/, replacement: `${AQUI}/stub-file-saver.js` },
      { find: /^\.\.\/services\/exportacionService$/, replacement: `${AQUI}/stub-exportacionService.js` },
    ],
  },
});

const fallas = [];
const revisar = (nombre, cond, detalle = '') => {
  if (!cond) fallas.push(nombre);
  console.log(`${cond ? '✓' : '✗'} ${nombre}${!cond && detalle ? `  (${detalle})` : ''}`);
};
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

try {
  // ── Postes por proyecto: lo mismo que perteneceAProyecto ──
  const { contarPorProyecto, perteneceAProyecto } = await server.ssrLoadModule('/src/utils/helpers.js');
  {
    let semilla = 7;
    const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
    const proyectos = Array.from({ length: 12 }, (_, i) => ({
      id: i % 3 === 0 ? 1000 + i : `p${i}`,   // algunos con id numérico, como los viejos
      dias: Array.from({ length: 3 }, (_, j) => ({ id: `d${i}_${j}` })),
    }));
    proyectos[5].dias.push({ id: 'd0_0' });   // un día repetido en dos proyectos
    const items = Array.from({ length: 4000 }, (_, k) => {
      const p = proyectos[Math.floor(azar() * proyectos.length)];
      const r = azar();
      const diaId = p.dias[Math.floor(azar() * p.dias.length)].id;
      if (r < 0.5) return { id: k, proyectoId: String(p.id), diaId };
      if (r < 0.6) return { id: k, proyectoId: p.id, diaId };               // numérico
      if (r < 0.7) return { id: k, proyectoId: 'otro', diaId };             // de un proyecto que no está
      if (r < 0.8) return { id: k, proyectoId: '', diaId };                 // vacío: cae al día
      if (r < 0.9) return { id: k, diaId };                                 // sin proyecto: cae al día
      return { id: k, diaId: 'ninguno' };
    });
    const cuenta = contarPorProyecto(proyectos, items);
    const distintos = proyectos.filter(p => cuenta.get(String(p.id)) !== items.filter(x => perteneceAProyecto(x, p)).length);
    revisar('postes por proyecto: igual que filtrar con perteneceAProyecto', distintos.length === 0,
      distintos.map(p => `${p.id}: ${cuenta.get(String(p.id))} ≠ ${items.filter(x => perteneceAProyecto(x, p)).length}`).join(', '));
  }

  const { default: VistaDiseno } = await server.ssrLoadModule(MODULO);
  const { useProjectLogic } = await server.ssrLoadModule(LOGICA);
  const { snapDocumento } = await server.ssrLoadModule(`${AQUI}/stub-firestore-vivo.js`);

  const PUNTOS = [
    { id: 'x1', proyectoId: 'P', coords: { lat: -16.409, lng: -71.537 } },
    { id: 'x2', proyectoId: 'P', coords: { lat: -16.4091, lng: -71.5371 } },
  ];
  const nada = () => {};
  const Envoltura = () => {
    const [proyectos, setProyectos] = React.useState([{ id: 'P', nombre: 'OBRA P', ownerId: 'U', dias: [] }]);
    const { crearProyectoDiseno } = useProjectLogic({
      user: { uid: 'U', displayName: 'Prueba' }, theme: {}, proyectos, setProyectos,
      proyectoActual: null, setProyectoActual: nada, setDiaActual: nada, diasVisibles: [], setDiasVisibles: nada,
      puntos: PUNTOS, tempData: {}, setPuntos: nada, setConexiones: nada, setModalOpen: nada, setConfirmData: nada,
      setAlertData: nada, irADestino: nada, setVista: nada, setMenuAbierto: nada, config: {},
    });
    return React.createElement(VistaDiseno, { onVolver: nada, proyectos, puntos: PUNTOS, onCrearProyecto: crearProyectoDiseno });
  };

  const cont = document.createElement('div'); document.body.appendChild(cont);
  let root;
  const montar = async () => {
    root = createRoot(cont);
    await act(async () => { root.render(React.createElement(React.StrictMode, null, React.createElement(Envoltura))); await esperar(10); });
  };
  const botones = () => [...cont.querySelectorAll('button')];
  const boton = (t) => botones().find(b => b.textContent.trim() === t);
  const tocar = async (el, ms = 20) => { await act(async () => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await esperar(ms); }); };
  const texto = () => cont.textContent;
  const escribirNombre = async (valor) => {
    const input = cont.querySelector('input[placeholder="Nombre del proyecto"]');
    const set = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set;
    await act(async () => { set.call(input, valor); input.dispatchEvent(new w.Event('input', { bubbles: true })); await esperar(5); });
  };

  // ── 1. Sin señal: el servidor no contesta nunca ──
  globalThis.__vivo = { registro: [], escuchas: [], rechazar: null, colgar: (path) => /^proyectos\/[^/]+$/.test(path) };
  const V = globalThis.__vivo;
  await montar();
  revisar('la lista cuenta los postes de cada proyecto', /OBRA P\s*2 pts/.test(texto()), texto().slice(0, 120));
  await tocar(boton('Nuevo proyecto'));
  await escribirNombre('OBRA NUEVA');
  await tocar(boton('Crear'), 30);

  const sets = V.registro.filter(r => r.op === 'set');
  const setProyecto = sets.find(r => /^proyectos\/[^/]+$/.test(r.path));
  const id = setProyecto?.path.split('/')[1];
  const rutaCat = `proyectos/${id}/diseno/catastro`;
  const iProyecto = V.registro.indexOf(setProyecto);
  const iCatastro = V.registro.findIndex(r => r.op === 'set' && r.path === rutaCat);
  const iEscucha = V.registro.findIndex(r => r.op === 'escucha' && r.path === rutaCat);

  revisar('sin señal: el proyecto se abre igual', texto().includes('OBRA NUEVA') && !texto().includes('Proyectos disponibles'));
  revisar('se escribe el proyecto', !!setProyecto && setProyecto.data?.nombre === 'OBRA NUEVA' && setProyecto.data?.creadoDesde === 'diseno');
  revisar('se escribe su catastro vacío', iCatastro >= 0 &&
    ['manzanas', 'calles', 'areas', 'etiquetas'].every(k => Array.isArray(V.registro[iCatastro].data?.[k]) && V.registro[iCatastro].data[k].length === 0),
    iCatastro >= 0 ? JSON.stringify(V.registro[iCatastro].data) : 'no se escribió');
  revisar('orden: proyecto → catastro vacío → escucha del catastro', iProyecto >= 0 && iProyecto < iCatastro && iCatastro < iEscucha,
    `proyecto ${iProyecto}, catastro ${iCatastro}, escucha ${iEscucha}`);

  // Firestore entrega en el acto lo que el equipo escribió: la prueba hace lo mismo
  const escuchaCat = V.escuchas.filter(e => e.abierta && e.path === rutaCat).pop();
  if (escuchaCat) {
    await act(async () => { escuchaCat.next(snapDocumento(rutaCat, V.registro[iCatastro]?.data)); await esperar(10); });
  }
  revisar('con el catastro del equipo, las herramientas están listas', !texto().includes('Cargando') &&
    ['Calles', 'Manzanas', 'Áreas', 'Puntos', 'Capas'].every(t => !!boton(t)));
  revisar('y avisa que el proyecto no tiene postes', texto().includes('Proyecto sin postes'));
  await act(async () => { root.unmount(); await esperar(5); });

  // ── 2. El servidor rechaza el proyecto ──
  globalThis.__vivo = { registro: [], escuchas: [], colgar: null, rechazar: (path) => (/^proyectos\/[^/]+$/.test(path) ? { code: 'permission-denied' } : null) };
  await montar();
  await tocar(boton('Nuevo proyecto'));
  await escribirNombre('OBRA RECHAZADA');
  await tocar(boton('Crear'), 40);
  const input = cont.querySelector('input[placeholder="Nombre del proyecto"]');
  revisar('rechazado: vuelve a la lista', texto().includes('Proyectos disponibles'));
  revisar('rechazado: el formulario sigue abierto con el nombre', input?.value === 'OBRA RECHAZADA', input ? `"${input.value}"` : 'sin formulario');
  revisar('rechazado: avisa', texto().includes('El servidor no aceptó el proyecto'));
  revisar('rechazado: no queda en la lista', ![...cont.querySelectorAll('button')].some(b => b.textContent.includes('OBRA RECHAZADA')));
  await act(async () => { root.unmount(); await esperar(5); });
} catch (e) {
  fallas.push(`se cayó: ${e.stack || e}`);
  console.log('✗ se cayó:', e.message || e);
} finally {
  await server.close();
}

console.log(`\nRESULTADO: ${fallas.length ? 'MAL' : 'OK'}`);
process.exit(fallas.length ? 1 : 0);
