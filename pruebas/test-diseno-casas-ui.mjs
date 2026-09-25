// Prueba con toques (jsdom) del formato regular y de los vértices con el dedo (25/09):
// la cuadra rectangular nace con sus casas; formatos, − / +, girar; familias de una
// casa; el aviso antes de rehacer; vértice y lado marcados que se mueven desde lejos;
// presionar y arrastrar para el 2.º punto; marcar un punto del dibujo; borrar.
//
// Los gestos van con eventos de puntero sobre el contenedor del mapa de mentira
// (stub-react-leaflet.jsx), que convierte x = lng·1e5, y = −lat·1e5.
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
  const px = (ll) => ({ x: ll[1] * 1e5, y: -ll[0] * 1e5 });

  const { default: VistaDiseno } = await server.ssrLoadModule(MODULO);
  globalThis.__fs = { docs: { 'proyectos/P/diseno/catastro': aFirestore({ calles: [], manzanas: [], ultimos: {} }) }, escrituras: [] };
  const cont = document.createElement('div'); document.body.appendChild(cont);
  const root = createRoot(cont);
  const props = { onVolver() {}, proyectos: [{ id: 'P', nombre: 'OBRA P', ownerId: 'U', dias: [] }], puntos: [], onCrearProyecto: () => 'X' };
  await act(async () => { root.render(React.createElement(VistaDiseno, props)); await esperar(10); });

  const botones = () => [...cont.querySelectorAll('button')];
  const boton = (t) => botones().find(b => b.textContent.trim() === t);
  const conTexto = (t) => botones().find(b => b.textContent.includes(t));
  const porTitulo = (t) => botones().find(b => b.title === t);
  const tocar = async (el, ms = 20) => { await act(async () => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await esperar(ms); }); };
  const texto = () => cont.textContent;
  const casas = () => [...cont.querySelectorAll('[data-poligono]')].filter(p => ['#4A9EFF', '#FACC15'].includes(p.dataset.color));
  const clicMapa = async (ll) => { await act(async () => { globalThis.__eventosMapa.click({ latlng: { lat: ll[0], lng: ll[1] } }); await esperar(20); }); };
  const sets = (path) => globalThis.__fs.escrituras.filter(e => e.op === 'set' && e.path === path);
  const ultimo = (path) => sets(path).pop()?.data;
  const RUTA_CAT = 'proyectos/P/diseno/catastro';
  const RUTA_C1 = 'proyectos/P/diseno/casas_manzana_001';
  const mapa = () => globalThis.__mapaFalso;
  const puntero = (tipo, x, y, id = 1) => {
    const ev = new w.MouseEvent(tipo, { clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(ev, 'pointerId', { value: id });
    mapa().getContainer().dispatchEvent(ev);
  };
  const arrastrar = async (dx, dy) => {
    await act(async () => {
      puntero('pointerdown', 500, 500);
      puntero('pointermove', 500 + dx / 2, 500 + dy / 2);
      puntero('pointermove', 500 + dx, 500 + dy);
      puntero('pointerup', 500 + dx, 500 + dy);
      await esperar(300); // una persona no vuelve a tocar antes
    });
  };
  const verticesCat = (i = 0) => (ultimo(RUTA_CAT)?.manzanas?.[i]?.latlngs || []).map(p => [p.lat, p.lng]);
  const cerca = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;

  await tocar(botones().find(b => b.textContent.includes('OBRA P')));

  // ── 1. La cuadra rectangular nace con sus casas ──
  await tocar(boton('Manzanas'));
  await tocar(boton('Cuadra rectangular'));
  await clicMapa(g(0, 0));
  await clicMapa(g(60, 0));
  await clicMapa(g(30, 30));
  let c1 = ultimo(RUTA_C1);
  revisar('al terminar la cuadra se guardan sus casas', !!c1 && c1.tipo === 'casas' && c1.manzanaId === 'manzana_001' && c1.editadas === false);
  revisar('nacen en Dos filas, una cada 6 m: 10 por fila', c1?.formato?.tipo === 'dos-filas' && c1.formato.n === 10 && c1.casas.length === 20,
    JSON.stringify(c1?.formato));
  revisar('los vértices de las casas van como {lat, lng} (Firestore no acepta arrays en arrays)',
    typeof c1?.casas?.[0]?.latlngs?.[0]?.lat === 'number');
  revisar('las 20 casas se ven en el mapa', casas().length === 20, `${casas().length}`);
  revisar('la manzana queda elegida con su formato a la vista',
    texto().includes('Seleccionado') && !!boton('Dos filas') && boton('Dos filas').className.includes('bg-brand-500') && texto().includes('Por fila'));
  revisar('muestra el total de casas y familias', texto().includes('20 casas · 20 familias'));
  revisar('ofrece ajustar vértices y lados', texto().includes('Toca un vértice o un lado para ajustarlo'));

  // ── 2. − / +, girar y formatos ──
  await tocar(porTitulo('Una casa más'));
  c1 = ultimo(RUTA_C1);
  revisar('+ suma una casa por fila', c1.formato.n === 11 && c1.casas.length === 22 && casas().length === 22);
  await tocar(conTexto('Girar'));
  c1 = ultimo(RUTA_C1);
  revisar('girar: filas a lo largo del lado corto, se recalcula (5 por fila)', c1.formato.giro === 1 && c1.formato.n === 5 && c1.casas.length === 10,
    JSON.stringify(c1.formato));
  await tocar(boton('Tres zonas'));
  c1 = ultimo(RUTA_C1);
  revisar('tres zonas: costados y centro', c1.formato.tipo === 'tres-zonas' && c1.casas.length === 2 * c1.formato.nLat + 2 * c1.formato.nCentro
    && texto().includes('Costados') && texto().includes('Centro'), JSON.stringify(c1.formato));
  await tocar(boton('Una fila'));
  c1 = ultimo(RUTA_C1);
  revisar('una fila: todo el fondo', c1.formato.tipo === 'una-fila' && c1.casas.length === c1.formato.n);
  const giroAntes = c1.formato.giro;
  await tocar(conTexto('Girar'));
  revisar('una fila gira por los 4 lados', ultimo(RUTA_C1).formato.giro === (giroAntes + 1) % 4 && texto().includes('/4'));
  await tocar(boton('Dos filas'));
  revisar('vuelve a Dos filas', ultimo(RUTA_C1).formato.tipo === 'dos-filas');

  // ── 3. Familias de una casa ──
  await tocar(casas()[0]);
  revisar('con la manzana elegida, tocar una casa abre la casa', texto().includes('Familias') && !!boton('Manzana'));
  await tocar(porTitulo('Una familia más'));
  c1 = ultimo(RUTA_C1);
  revisar('familias + se guarda y marca la manzana como editada', c1.editadas === true && c1.casas[0].familias === 2 && texto().includes('Casa de esquina'));
  await tocar(porTitulo('Una familia menos'));
  await tocar(porTitulo('Una familia menos'));
  revisar('0 familias: no es vivienda', ultimo(RUTA_C1).casas[0].familias === 0 && texto().includes('No es vivienda'));
  await tocar(porTitulo('Una familia más'));
  await tocar(porTitulo('Una familia más'));
  await tocar(boton('Manzana'));
  revisar('"Manzana" vuelve al panel de la manzana', texto().includes('Seleccionado') && !!boton('Tres zonas'));

  // ── 4. El aviso antes de rehacer ──
  let n = sets(RUTA_C1).length;
  await tocar(boton('Tres zonas'));
  revisar('con familias cambiadas, otro formato avisa primero y no toca nada',
    texto().includes('familias cambiadas a mano') && sets(RUTA_C1).length === n);
  await tocar(boton('No'));
  revisar('"No" deja todo como estaba', !texto().includes('familias cambiadas a mano') && ultimo(RUTA_C1).formato.tipo === 'dos-filas');
  await tocar(boton('Tres zonas'));
  await tocar(boton('Sí, rehacer'));
  c1 = ultimo(RUTA_C1);
  revisar('"Sí, rehacer" rehace las casas con 1 familia', c1.formato.tipo === 'tres-zonas' && c1.editadas === false && c1.casas.every(c => c.familias === 1));
  await tocar(boton('Dos filas'));

  // ── 5. Primer toque: la manzana ──
  await tocar(porTitulo('Cerrar'));
  await tocar(casas()[3]);
  revisar('sin nada elegido, tocar una casa elige su manzana', texto().includes('Seleccionado') && !texto().includes('Familias'));

  // ── 6. Vértice marcado, movido desde lejos ──
  const toquesVertice = () => [...cont.querySelectorAll('[data-clase="toque-vertice"]')];
  const toquesLado = () => [...cont.querySelectorAll('[data-clase="toque-lado"]')];
  revisar('la manzana elegida muestra sus 4 vértices y 4 lados para tocar', toquesVertice().length === 4 && toquesLado().length === 4);
  const antes = JSON.parse(cont.querySelector('[data-poligono][data-color="#FF6600"]').dataset.puntos);
  await tocar(toquesVertice()[2]);
  revisar('tocar un vértice lo marca', texto().includes('Vértice marcado') && !!boton('Listo'));
  revisar('con un vértice marcado, un dedo ya no arrastra el mapa', mapa().dragging.enabled() === false);
  await arrastrar(30, 0);
  let v = verticesCat();
  revisar('arrastrar desde cualquier parte mueve el vértice lo mismo que el dedo',
    cerca(v[2][1], antes[2][1] + 30 / 1e5) && cerca(v[2][0], antes[2][0]) && cerca(v[0][1], antes[0][1]),
    JSON.stringify({ antes: antes[2], despues: v[2] }));
  revisar('y las casas se rehacen con la forma nueva', ultimo(RUTA_C1).casas.length === casas().length && sets(RUTA_C1).length > n);
  revisar('sigue marcado para seguir ajustando', texto().includes('Vértice marcado'));
  await tocar(boton('Listo'));
  revisar('"Listo" lo suelta y el mapa vuelve a arrastrarse', !texto().includes('Vértice marcado') && mapa().dragging.enabled() === true);

  // ── 7. Lado marcado (solo en las regulares): se mueve paralelo ──
  await tocar(toquesLado()[0]);
  revisar('tocar un lado lo marca', texto().includes('Lado marcado'));
  const v0 = verticesCat();
  await arrastrar(7, 20);
  v = verticesCat();
  revisar('el lado se corre perpendicular a sí mismo; el otro lado no se mueve',
    cerca(v[0][0], v0[0][0] - 20 / 1e5, 1e-6) && cerca(v[1][0], v0[1][0] - 20 / 1e5, 1e-6)
    && cerca(v[2][0], v0[2][0]) && cerca(v[3][0], v0[3][0]),
    JSON.stringify({ v0, v }));
  const nCat = sets(RUTA_CAT).length;
  await act(async () => {
    puntero('pointerdown', 500, 500, 1);
    puntero('pointermove', 510, 530, 1);
    puntero('pointerdown', 600, 600, 2); // segundo dedo: es un gesto del mapa
    puntero('pointerup', 600, 600, 2);
    puntero('pointerup', 510, 530, 1);
    await esperar(30);
  });
  revisar('con un segundo dedo el arrastre se cancela y no se guarda nada', sets(RUTA_CAT).length === nCat);
  await tocar(boton('Listo'));

  // ── 8. Forma nueva con familias cambiadas: avisa ──
  await tocar(casas()[0]);
  await tocar(porTitulo('Una familia más'));
  await tocar(boton('Manzana'));
  await tocar(toquesVertice()[1]);
  const nCat2 = sets(RUTA_CAT).length;
  await arrastrar(25, 0);
  revisar('mover un vértice con familias cambiadas avisa y no guarda', texto().includes('familias cambiadas a mano') && sets(RUTA_CAT).length === nCat2);
  await tocar(boton('No'));
  revisar('"No" deja la forma como estaba', sets(RUTA_CAT).length === nCat2 && !texto().includes('familias cambiadas a mano'));

  // ── 9. Presionar y arrastrar: el 2.º punto de otra cuadra ──
  await tocar(porTitulo('Cerrar'));
  await tocar(boton('Manzanas'));
  await tocar(boton('Cuadra rectangular'));
  await clicMapa(g(100, 0));
  const inicioP = px(g(158, 0)), finP = px(g(162, 0));
  await act(async () => {
    puntero('pointerdown', inicioP.x, inicioP.y);
    await esperar(450);
    puntero('pointermove', (inicioP.x + finP.x) / 2, inicioP.y);
    puntero('pointermove', finP.x, finP.y);
    await esperar(10);
  });
  revisar('mantener presionado deja de arrastrar el mapa y dibuja', mapa().dragging.enabled() === false);
  await act(async () => { puntero('pointerup', finP.x, finP.y); await esperar(300); });
  revisar('al soltar, el mapa vuelve a arrastrarse', mapa().dragging.enabled() === true);
  revisar('y queda puesto el 2.º punto (sigue pidiendo el ancho)', texto().includes('Ancho'));
  await clicMapa(g(130, 30));
  const m2 = verticesCat(1);
  revisar('la cuadra usa el punto donde se soltó', m2.length === 4 && cerca(m2[1][1], g(162, 0)[1], 1e-6) && cerca(m2[1][0], g(162, 0)[0], 1e-6),
    JSON.stringify(m2[1]));
  revisar('y nace con sus casas', !!ultimo('proyectos/P/diseno/casas_manzana_002'));

  // ── 10. Marcar un punto del dibujo y moverlo desde lejos ──
  await tocar(porTitulo('Cerrar'));
  await tocar(boton('Manzanas'));
  await tocar(boton('Cuadra rectangular'));
  await clicMapa(g(200, 0));
  await tocar(cont.querySelector('[data-clase="toque-punto"]'));
  revisar('tocar un punto ya puesto lo marca', texto().includes('Punto marcado'));
  await arrastrar(40, 0);
  const marcadoAhora = [...cont.querySelectorAll('[data-circulo]')].find(c => c.dataset.radio === '8');
  const centro = marcadoAhora ? JSON.parse(marcadoAhora.dataset.centro) : null;
  revisar('arrastrar desde lejos mueve el punto', !!centro && cerca(centro[1], g(200, 0)[1] + 40 / 1e5), JSON.stringify(centro));
  await clicMapa(g(300, 50));
  revisar('tocar el mapa lo suelta sin poner otro punto', !texto().includes('Punto marcado') && texto().includes('Fin de la base'));
  await clicMapa(g(260, 0));
  await clicMapa(g(230, 30));
  const m3 = verticesCat(2);
  revisar('la cuadra sale con el punto movido', m3.length === 4 && cerca(m3[0][1], g(200, 0)[1] + 40 / 1e5, 1e-6), JSON.stringify(m3[0]));

  // ── 11. Borrar la manzana borra sus casas ──
  await tocar(porTitulo('Cerrar'));
  await tocar(casas()[0]);
  const casasAntes = casas().length, casasDeLa1 = ultimo(RUTA_C1).casas.length;
  await tocar(boton('Borrar'));
  await tocar(boton('Sí, borrar'));
  revisar('borrar la manzana borra su documento de casas',
    globalThis.__fs.escrituras.some(e => e.op === 'delete' && e.path === RUTA_C1));
  revisar('y sus casas dejan de verse; las de las otras siguen', casas().length === casasAntes - casasDeLa1,
    `${casasAntes} → ${casas().length} (la 1 tenía ${casasDeLa1})`);
  await act(async () => { await esperar(700); }); // el catastro se guarda con 600 ms de retardo
  revisar('y la manzana sale del catastro guardado', !ultimo(RUTA_CAT).manzanas.some(m => m.id === 'manzana_001'));

  await act(async () => { root.unmount(); });
} catch (e) {
  fallas.push(`se cayó: ${e.stack || e}`);
  console.log('✗ se cayó:', e.stack || e);
} finally {
  await server.close();
}

console.log(`\nRESULTADO: ${fallas.length ? 'MAL' : 'OK'}`);
process.exit(fallas.length ? 1 : 0);
