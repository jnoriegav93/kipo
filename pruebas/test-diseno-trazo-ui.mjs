// Prueba con toques (jsdom): al cancelar un dibujo y empezar otro, no queda una línea
// colgando desde donde estaba el dedo en el dibujo anterior (el usuario, 25/09).
// La vista previa guardaba esa última posición y nadie la borraba al cancelar.
// Se prueba con una cuadra irregular y con una calle.
// Control: con la ruta de otra versión de la vista, TIENE que fallar.
import { JSDOM } from 'jsdom';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const KIPO = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const AQUI = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const MODULO = process.argv[2] || '/src/views/VistaDiseno.jsx';

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
      { find: /^\.\.\/firebaseConfig$/, replacement: `${AQUI}/stub-firebaseConfig.js` },
      { find: /^firebase\/firestore$/, replacement: `${AQUI}/stub-firestore.js` },
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
  const { aGrados, aFirestore } = await server.ssrLoadModule('/src/utils/disenoGeo.js');
  const REF = [-16.409, -71.537];
  const g = (x, y) => aGrados([x, y], REF);

  const { default: VistaDiseno } = await server.ssrLoadModule(MODULO);
  globalThis.__fs = { docs: { 'proyectos/P/diseno/catastro': aFirestore({ calles: [], manzanas: [], ultimos: {} }) }, escrituras: [] };
  const cont = document.createElement('div'); document.body.appendChild(cont);
  const root = createRoot(cont);
  const props = { onVolver() {}, proyectos: [{ id: 'P', nombre: 'OBRA P', ownerId: 'U', dias: [] }], puntos: [], onCrearProyecto: () => 'X' };
  await act(async () => { root.render(React.createElement(VistaDiseno, props)); await esperar(10); });

  const botones = () => [...cont.querySelectorAll('button')];
  const boton = (t) => botones().find(b => b.textContent.trim() === t);
  const porTitulo = (t) => botones().find(b => b.title === t);
  const tocar = async (el) => { await act(async () => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await esperar(20); }); };
  const mapa = async (evento, ll) => { await act(async () => { globalThis.__eventosMapa[evento]({ latlng: { lat: ll[0], lng: ll[1] } }); await esperar(20); }); };
  // La vista previa del dibujo: línea naranja punteada, con los puntos que une
  const previas = () => [...cont.querySelectorAll('[data-linea]')]
    .filter(l => l.dataset.color === '#FF6600' && l.dataset.trazo === '6 4')
    .map(l => JSON.parse(l.dataset.puntos));

  await tocar(botones().find(b => b.textContent.includes('OBRA P')));

  // ── Cuadra irregular ──
  await tocar(boton('Manzanas'));
  await tocar(boton('Cuadra irregular'));
  await mapa('click', g(0, 0));
  await mapa('mousemove', g(50, 40)); // el dedo o el ratón pasan por ahí: la previa lo sigue
  revisar('dibujando, la previa va del último punto al dedo', previas().some(p => p.length === 2));
  await tocar(porTitulo('Cancelar'));
  await tocar(boton('Manzanas'));
  await tocar(boton('Cuadra irregular'));
  await mapa('click', g(300, 300));
  revisar('cuadra: al empezar de nuevo, el primer punto no arrastra una línea del dibujo anterior',
    previas().every(p => p.length < 2), JSON.stringify(previas()));
  await tocar(porTitulo('Cancelar'));

  // ── Calle ──
  await tocar(boton('Calles'));
  await tocar(boton('Dibujar calle'));
  await mapa('click', g(0, 0));
  await mapa('mousemove', g(80, 0));
  revisar('calle: dibujando, la previa sigue al dedo', previas().some(p => p.length === 2));
  await tocar(porTitulo('Cancelar'));
  await tocar(boton('Calles'));
  await tocar(boton('Dibujar calle'));
  await mapa('click', g(300, 300));
  revisar('calle: al empezar de nuevo, el primer punto no arrastra una línea de la anterior',
    previas().every(p => p.length < 2), JSON.stringify(previas()));

  await act(async () => { root.unmount(); });
} catch (e) {
  fallas.push(`se cayó: ${e.stack || e}`);
  console.log('✗ se cayó:', e.stack || e);
} finally {
  await server.close();
}

console.log(`\nRESULTADO: ${fallas.length ? 'MAL' : 'OK'}`);
process.exit(fallas.length ? 1 : 0);
