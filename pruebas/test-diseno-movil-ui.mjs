// Prueba con toques (jsdom) del modo Diseño en el CELULAR: vertical, horizontal y PC.
// La pantalla se elige por el tamaño de la ventana (vertical, horizontal o PC), así que
// la prueba cambia innerWidth / innerHeight y avisa con 'resize'.
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
const tamano = (ancho, alto) => {
  Object.defineProperty(w, 'innerWidth', { value: ancho, configurable: true });
  Object.defineProperty(w, 'innerHeight', { value: alto, configurable: true });
};
tamano(390, 844); // celular vertical desde el arranque

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
  const props = { onVolver() {}, proyectos: [{ id: 'P', nombre: 'OBRA P', ownerId: 'U', dias: [] }], puntos: [], onCrearProyecto: async () => 'X' };
  await act(async () => { root.render(React.createElement(VistaDiseno, props)); await esperar(10); });

  const botones = () => [...cont.querySelectorAll('button')];
  const boton = (t) => botones().find(b => b.textContent.trim() === t);
  const porTitulo = (t) => botones().find(b => b.title === t);
  const tocar = async (el) => { await act(async () => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await esperar(20); }); };
  const texto = () => cont.textContent;
  const girar = async (ancho, alto) => { tamano(ancho, alto); await act(async () => { w.dispatchEvent(new w.Event('resize')); await esperar(20); }); };
  const manzanas = () => [...cont.querySelectorAll('[data-poligono]')].filter(p => p.dataset.color === '#E7EAEF');

  await tocar(botones().find(b => b.textContent.includes('OBRA P')));
  await act(async () => { await esperar(20); });

  // ── VERTICAL ──
  revisar('vertical: sin la barra de pasos', !texto().includes('1. Catastro'));
  revisar('vertical: barra de abajo con los 5 grupos', ['Calles', 'Manzanas', 'Áreas', 'Puntos', 'Capas'].every(t => !!boton(t)));
  revisar('vertical: sin panel fijo (las herramientas están guardadas)', !boton('Dibujar calle') && !boton('Desde calles'));
  revisar('vertical: sin barra de estado; el guardado va arriba', !texto().includes('6 calles') && texto().includes('Guardado'));
  revisar('vertical: la cabecera lleva el nombre del proyecto', texto().includes('OBRA P'));

  await tocar(boton('Manzanas'));
  revisar('vertical: "Manzanas" abre su hoja', !!boton('Desde calles') && !!boton('Cuadra rectangular') && !!boton('Cuadra irregular'));
  await tocar(boton('Desde calles'));
  revisar('vertical: al elegir, la hoja se cierra y salen las candidatas', !boton('Cuadra rectangular') && texto().includes('4 de 4 manzanas'));
  revisar('vertical: el grupo activo queda marcado', (boton('Manzanas')?.className || '').includes('bg-brand-500'));
  if (boton('Confirmar')) await tocar(boton('Confirmar'));
  await act(async () => { await esperar(700); });
  revisar('vertical: confirmar crea las 4 manzanas', manzanas().length === 4);

  await tocar(manzanas()[0]);
  revisar('vertical: tocar una manzana abre su hoja con Borrar', texto().includes('Seleccionado') && !!boton('Borrar'));
  revisar('vertical: la hoja se cierra con X, sin "Deseleccionar"', !!porTitulo('Cerrar') && !boton('Deseleccionar'));
  await tocar(porTitulo('Cerrar'));
  revisar('vertical: cerrada', !texto().includes('Seleccionado'));

  await tocar(porTitulo('Menú'));
  revisar('vertical: el menú tiene el proyecto y los pasos', !!boton('Cambiar de proyecto') && texto().includes('1. Catastro') && texto().includes('2. Tramos'));
  await tocar(cont.querySelector('.fixed.inset-0.z-\\[1200\\]'));
  revisar('vertical: tocar afuera cierra el menú', !boton('Cambiar de proyecto'));

  await tocar(porTitulo('Buscar lugar'));
  revisar('vertical: la lupa abre el buscador', !!cont.querySelector('input[placeholder="Buscar ciudad, distrito o calle"]'));
  await tocar(porTitulo('Cerrar'));
  revisar('vertical: y se cierra', !cont.querySelector('input[placeholder="Buscar ciudad, distrito o calle"]'));

  await tocar(boton('Calles'));
  await tocar(boton('Dibujar calle'));
  revisar('vertical: dibujar calle muestra su barra de arriba', texto().includes('Traza el borde de la manzana') && !!boton('Terminar'));
  await tocar(porTitulo('Cancelar'));

  // ── HORIZONTAL ──
  await girar(844, 390);
  revisar('horizontal: sin cabecera (el volver va en la barra)', !!porTitulo('Volver') && !texto().includes('Guardado'));
  revisar('horizontal: la barra de la izquierda tiene los grupos, sin rótulos', ['Calles', 'Manzanas', 'Áreas', 'Puntos', 'Capas'].every(t => !!porTitulo(t) && !boton(t)));
  await tocar(porTitulo('Capas'));
  revisar('horizontal: "Capas" abre su hoja con los conteos', texto().includes('Calles6') || /Calles\s*6/.test(texto()));
  await tocar(porTitulo('Capas'));
  await tocar(manzanas()[0]);
  const hoja = [...cont.querySelectorAll('div')].find(d => d.className.includes('right-2') && d.textContent.includes('Seleccionado'));
  revisar('horizontal: lo seleccionado sale a la derecha', !!hoja);
  await tocar(porTitulo('Cerrar'));

  // ── PC ──
  await girar(1366, 768);
  revisar('pc: panel fijo con las herramientas y barra de estado', !!boton('Dibujar calle') && texto().includes('6 calles'));
  revisar('pc: sin barra de abajo ni barra de pasos', !porTitulo('Puntos') && !texto().includes('1. Catastro'));

  await act(async () => { root.unmount(); });
} catch (e) {
  fallas.push(`se cayó: ${e.stack || e}`);
  console.log('✗ se cayó:', e.message || e);
} finally {
  await server.close();
}
console.log(fallas.length ? `RESULTADO: MAL (${fallas.length})` : 'RESULTADO: OK');
process.exit(fallas.length ? 1 : 0);
