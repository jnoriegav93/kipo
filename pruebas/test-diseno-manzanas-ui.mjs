// Prueba con toques (jsdom + react-dom/client) del modo Diseño: MANZANAS DESDE CALLES,
// borrar con segundo toque y números que no se repiten. Firestore y react-leaflet son de
// mentira (stub-firestore.js, stub-react-leaflet.jsx): cada polígono es un <div> tocable.
import { JSDOM } from 'jsdom';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const KIPO = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const AQUI = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const MODULO = process.argv[2] || '/src/views/VistaDiseno.jsx'; // otro para la corrida de control

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://kipo-d29af.web.app/', pretendToBeVisual: true });
const w = dom.window;
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event', 'localStorage', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  try { globalThis[k] = k === 'window' ? w : w[k]; } catch { /* solo lectura */ }
}
Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true });
// Leaflet mira clases del navegador al cargar (HTMLAnchorElement, SVGElement…)
for (const k of Object.getOwnPropertyNames(w)) {
  if (/^(HTML|SVG)\w*Element$/.test(k) && !(k in globalThis)) globalThis[k] = w[k];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

const { aGrados, aFirestore } = await server.ssrLoadModule('/src/utils/disenoGeo.js');
const REF = [-16.409, -71.537];
const g = (x, y) => aGrados([x, y], REF);
const vertical = (id, x) => ({ id, A: [g(x, -10), g(x, 220)], B: [g(x + 10, -10), g(x + 10, 220)], ancho: 10 });
const horizontal = (id, y) => ({ id, A: [g(-10, y), g(220, y)], B: [g(-10, y + 10), g(220, y + 10)], ancho: 10 });
const CALLES = [vertical('calle_001', 0), vertical('calle_002', 100), vertical('calle_003', 200),
  horizontal('calle_004', 0), horizontal('calle_005', 100), horizontal('calle_006', 200)];

const fallas = [];
const revisar = (nombre, cond) => { if (!cond) fallas.push(nombre); console.log(`${cond ? '✓' : '✗'} ${nombre}`); };
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

try {
  const { default: VistaDiseno } = await server.ssrLoadModule(MODULO);
  globalThis.__fs = { docs: { 'proyectos/P/diseno/catastro': aFirestore({ calles: CALLES, manzanas: [], ultimos: { calle: 6 } }) }, escrituras: [] };
  const cont = document.createElement('div'); document.body.appendChild(cont);
  const root = createRoot(cont);
  const props = { onVolver() {}, proyectos: [{ id: 'P', nombre: 'OBRA P', ownerId: 'U', dias: [] }], puntos: [], onCrearProyecto: () => 'X' };
  await act(async () => { root.render(React.createElement(VistaDiseno, props)); await esperar(10); });

  const botones = () => [...cont.querySelectorAll('button')];
  const boton = (t) => botones().find(b => b.textContent.trim() === t);
  const tocar = async (el) => { await act(async () => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await esperar(20); }); };
  const poligonos = (color, trazo) => [...cont.querySelectorAll('[data-poligono]')]
    .filter(p => (color == null || p.dataset.color === color) && (trazo == null || p.dataset.trazo === trazo));
  const texto = () => cont.textContent;
  const ultimoGuardado = () => [...globalThis.__fs.escrituras].reverse().find(e => e.path === 'proyectos/P/diseno/catastro');
  const idsGuardados = () => (ultimoGuardado()?.data.manzanas || []).map(m => m.id);

  await tocar(botones().find(b => b.textContent.includes('OBRA P')));
  await act(async () => { await esperar(20); });
  revisar('abre la obra con sus 6 calles y ninguna manzana', texto().includes('6 calles') && texto().includes('0 manzanas'));

  const desde = boton('Desde calles');
  revisar('hay botón "Desde calles"', !!desde);
  if (desde) await tocar(desde);
  revisar('salen 4 candidatas, todas marcadas', poligonos('#FF6600', '7 5').length === 4 && texto().includes('4 de 4 manzanas'));

  await tocar(poligonos('#FF6600', '7 5')[0]);
  revisar('un toque quita una: 3 de 4', poligonos('#FF6600', '7 5').length === 3 && poligonos('#8B94A5').length === 1 && texto().includes('3 de 4 manzanas'));

  if (boton('Confirmar')) await tocar(boton('Confirmar'));
  await act(async () => { await esperar(700); }); // el guardado espera 600 ms
  const g1 = ultimoGuardado();
  revisar('confirmar guarda 3 manzanas "desde calles"', !!g1 && g1.data.manzanas.length === 3 && g1.data.manzanas.every(m => m.forma === 'calles'));
  revisar('con números 001 a 003 y el último anotado', JSON.stringify(idsGuardados()) === '["manzana_001","manzana_002","manzana_003"]' && g1?.data.ultimos?.manzana === 3);
  revisar('las calles no se tocaron', JSON.stringify(g1?.data.calles) === JSON.stringify(aFirestore(CALLES)));
  revisar('la barra dice 3 manzanas y ya no hay candidatas', texto().includes('3 manzanas') && poligonos('#FF6600', '7 5').length === 0);

  // Seleccionar una manzana: dice cómo nació; borrar pide un segundo toque
  await tocar(poligonos('#E7EAEF')[0]);
  revisar('la manzana dice "Desde calles (irregular)"', texto().includes('Desde calles (irregular)'));
  if (boton('Borrar')) await tocar(boton('Borrar'));
  revisar('Borrar pregunta antes', texto().includes('No se puede deshacer') && !!boton('Sí, borrar'));
  if (boton('No')) await tocar(boton('No'));
  revisar('"No" no borra nada', texto().includes('3 manzanas') && !texto().includes('No se puede deshacer'));
  if (boton('Borrar')) await tocar(boton('Borrar'));
  if (boton('Sí, borrar')) await tocar(boton('Sí, borrar'));
  await act(async () => { await esperar(700); });
  const quedan = idsGuardados();
  revisar('"Sí, borrar" la borra', quedan.length === 2);

  // Otra vez desde calles: las 2 que existen salen grises; las nuevas NO repiten número
  if (boton('Desde calles')) await tocar(boton('Desde calles'));
  revisar('ahora 2 de 4 (las que ya existen salen grises)', texto().includes('2 de 4 manzanas') && poligonos('#8B94A5').length === 2);
  if (boton('Confirmar')) await tocar(boton('Confirmar'));
  await act(async () => { await esperar(700); });
  const finales = idsGuardados();
  const nuevas = finales.filter(id => !quedan.includes(id)).sort();
  revisar('las nuevas son 004 y 005: no reutilizan el número borrado', JSON.stringify(nuevas) === '["manzana_004","manzana_005"]');
  revisar('sin números repetidos', new Set(finales).size === finales.length && finales.length === 4);

  await act(async () => { root.unmount(); });
} catch (e) {
  fallas.push(`se cayó: ${e.stack || e}`);
  console.log('✗ se cayó:', e.message || e);
} finally {
  await server.close();
}
console.log(fallas.length ? `RESULTADO: MAL (${fallas.length})` : 'RESULTADO: OK');
process.exit(fallas.length ? 1 : 0);
