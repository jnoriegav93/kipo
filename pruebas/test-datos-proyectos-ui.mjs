// Prueba con React (jsdom, StrictMode) de useFirebaseData: qué escuchas de puntos, fibras
// y cables se abren y se cierran al cambiar la lista de proyectos (24/09).
// Firestore de mentira (stub-firestore-vivo.js): la prueba responde cada escucha a mano.
//
// Control: con la ruta de otra versión del hook (por ejemplo, la del commit anterior
// copiada dentro de src/hooks), lo del proyecto nuevo TIENE que fallar.
//   node pruebas/test-datos-proyectos-ui.mjs /src/hooks/useFirebaseData.control.js
import { JSDOM } from 'jsdom';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const KIPO = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const AQUI = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const MODULO = process.argv[2] || '/src/hooks/useFirebaseData.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://kipo-d29af.web.app/', pretendToBeVisual: true });
const w = dom.window;
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage']) {
  try { globalThis[k] = k === 'window' ? w : w[k]; } catch { /* solo lectura */ }
}
Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true });
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
  resolve: {
    alias: [
      { find: /^\.\.\/firebaseConfig$/, replacement: `${AQUI}/stub-firebaseConfig-vivo.js` },
      { find: /^firebase\/firestore$/, replacement: `${AQUI}/stub-firestore-vivo.js` },
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
  const { useFirebaseData } = await server.ssrLoadModule(MODULO);
  const { snapConsulta, snapDocumento } = await server.ssrLoadModule(`${AQUI}/stub-firestore-vivo.js`);
  globalThis.__vivo = { registro: [], escuchas: [], rechazar: null };
  const V = globalThis.__vivo;

  const COLECCIONES = ['puntos', 'conexiones', 'cablesAcero'];
  const nombres = (letra, n) => Array.from({ length: n }, (_, i) => `${letra}${String(i + 1).padStart(2, '0')}`);
  const PROPIOS = nombres('P', 25), COMPARTIDOS = nombres('S', 10);
  const proyecto = (id, dueno) => ({ id, nombre: `OBRA ${id}`, ownerId: dueno, miembros: {}, miembrosUids: ['U'], dias: [] });
  const postes = {};
  [...PROPIOS, ...COMPARTIDOS].forEach(id => { postes[id] = [{ id: `${id}-a`, proyectoId: id }, { id: `${id}-b`, proyectoId: id }]; });

  const inDe = (e) => e.filtros.find(f => f.op === 'in')?.val || [];
  const abiertas = (col) => V.escuchas.filter(e => e.abierta && e.path === col);
  const deProyectos = (campo) => V.escuchas.find(e => e.abierta && e.path === 'proyectos' && e.filtros[0]?.campo === campo);
  const responder = async (e, fuente) => {
    await act(async () => { e.next(snapConsulta(inDe(e).flatMap(id => fuente[id] || []))); await esperar(5); });
  };
  const responderTodas = async (col, fuente = {}) => { for (const e of abiertas(col)) await responder(e, fuente); };
  const emitirPropios = async (ids) => {
    await act(async () => { deProyectos('ownerId').next(snapConsulta(ids.map(id => proyecto(id, 'U')))); await esperar(5); });
  };
  const emitirCompartidos = async (ids) => {
    await act(async () => { deProyectos('miembrosUids').next(snapConsulta(ids.map(id => proyecto(id, 'OTRO')))); await esperar(5); });
  };
  const datos = () => globalThis.__datos;
  const desde = (n) => V.registro.slice(n).filter(r => COLECCIONES.includes(r.path));

  const Sonda = ({ user }) => { globalThis.__datos = useFirebaseData(user); return null; };
  const cont = document.createElement('div'); document.body.appendChild(cont);
  const root = createRoot(cont);
  const montar = (user) => React.createElement(React.StrictMode, null, React.createElement(Sonda, { user }));
  await act(async () => { root.render(montar({ uid: 'U' })); await esperar(20); });

  revisar('escucha los proyectos propios y los compartidos', !!deProyectos('ownerId') && !!deProyectos('miembrosUids'));
  const cfg = V.escuchas.find(e => e.abierta && e.path === 'configuraciones/U');
  if (cfg) await act(async () => { cfg.next(snapDocumento('configuraciones/U', { nombrePersonal: 'Prueba' })); await esperar(5); });

  // Arranque: llegan los propios y luego los compartidos
  await emitirPropios(PROPIOS);
  await emitirCompartidos(COMPARTIDOS);
  const grupos = COLECCIONES.map(c => abiertas(c).map(e => inDe(e).length));
  revisar('arranque: por colección, dos grupos de 30 y 5, como antes', grupos.every(g => JSON.stringify(g) === '[30,5]'), JSON.stringify(grupos));

  // No se publica hasta que llegan los dos grupos
  const [p1, p2] = abiertas('puntos');
  await responder(p1, postes);
  revisar('no publica los puntos con un grupo sin llegar', datos().puntos.length === 0, `${datos().puntos.length}`);
  await responder(p2, postes);
  revisar('publica los puntos al llegar los dos grupos', datos().puntos.length === 70, `${datos().puntos.length}`);
  await responderTodas('conexiones');
  await responderTodas('cablesAcero');

  // Proyecto nuevo (propio): UNA escucha por colección, solo con él, y ninguna se cierra
  const n = V.registro.length;
  await emitirPropios([...PROPIOS, 'P26']);
  const cambios = desde(n);
  const abiertasNuevas = cambios.filter(r => r.op === 'escucha');
  const cerradas = cambios.filter(r => r.op === 'cierra');
  revisar('proyecto nuevo: se abre una escucha por colección, solo con él',
    abiertasNuevas.length === 3 && abiertasNuevas.every(r => JSON.stringify(r.filtros[0].val) === '["P26"]'),
    `${abiertasNuevas.length} abiertas: ${JSON.stringify(abiertasNuevas.map(r => r.filtros[0]?.val?.length))} proyectos`);
  revisar('proyecto nuevo: no se cierra ninguna escucha', cerradas.length === 0, `${cerradas.length} cerradas`);
  revisar('proyecto nuevo: los puntos de las demás obras siguen a la vista', datos().puntos.length === 70, `${datos().puntos.length}`);

  // Un poste nuevo en otra obra se ve sin esperar a que responda la escucha del proyecto nuevo
  postes.P01 = [...postes.P01, { id: 'P01-c', proyectoId: 'P01' }];
  if (p1.abierta) await responder(p1, postes);
  revisar('un poste nuevo en otra obra se ve sin esperar al proyecto nuevo', datos().puntos.some(p => p.id === 'P01-c'));

  // Responde la escucha del proyecto nuevo con su primer poste
  postes.P26 = [{ id: 'P26-a', proyectoId: 'P26' }];
  const pNuevo = abiertas('puntos').find(e => JSON.stringify(inDe(e)) === '["P26"]');
  if (pNuevo) await responder(pNuevo, postes);
  revisar('el poste del proyecto nuevo se ve', datos().puntos.some(p => p.id === 'P26-a'));
  revisar('y siguen todos los demás', datos().puntos.length === 72, `${datos().puntos.length}`);

  // Sale una obra compartida: no se abre ni se cierra nada, y sus postes dejan de verse ya
  const n2 = V.registro.length;
  await emitirCompartidos(COMPARTIDOS.filter(id => id !== 'S03'));
  revisar('obra que sale: no se abre ni se cierra ninguna escucha', desde(n2).length === 0, `${desde(n2).length} cambios`);
  revisar('obra que sale: sus postes dejan de verse en el acto', !datos().puntos.some(p => p.proyectoId === 'S03') && datos().puntos.length === 70,
    `${datos().puntos.length}`);

  // Un cambio optimista (setPuntos) se ve hasta que llega el siguiente snapshot
  await act(async () => { datos().setPuntos(prev => [...prev, { id: 'borrador', proyectoId: 'P02' }]); await esperar(5); });
  revisar('setPuntos sigue sirviendo para los cambios optimistas', datos().puntos.some(p => p.id === 'borrador'));

  // Cerrar sesión: todo cerrado y sin puntos
  await act(async () => { root.render(montar(null)); await esperar(20); });
  revisar('al cerrar sesión se cierran todas las escuchas', COLECCIONES.every(c => abiertas(c).length === 0),
    JSON.stringify(COLECCIONES.map(c => abiertas(c).length)));
  revisar('al cerrar sesión no quedan puntos', datos().puntos.length === 0, `${datos().puntos.length}`);

  // Otra sesión: vuelve a armar de 30 en 30
  await act(async () => { root.render(montar({ uid: 'U' })); await esperar(20); });
  await emitirCompartidos(COMPARTIDOS);
  await emitirPropios([...PROPIOS, 'P26']);
  const grupos2 = COLECCIONES.map(c => abiertas(c).map(e => inDe(e).length));
  revisar('otra sesión: de 30 en 30 con todo lo visible', grupos2.every(g => JSON.stringify(g) === '[30,6]'), JSON.stringify(grupos2));

  await act(async () => { root.unmount(); await esperar(10); });
  revisar('al desmontar se cierran todas', V.escuchas.every(e => !e.abierta));
} catch (e) {
  console.error(e);
  fallas.push('excepción');
} finally {
  await server.close();
}

console.log(`\nRESULTADO: ${fallas.length ? 'MAL' : 'OK'}`);
process.exit(fallas.length ? 1 : 0);
