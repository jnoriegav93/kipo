// Render en Node de EquipoProyecto y ModalAvisos (paso 3c): la prueba de humo solo llega
// al login y no ve lo que hay dentro de EQUIPO. Se cargan con Vite (SSR) tal como están
// en src/, con firebaseConfig reemplazado por uno sin conexión.
// Revisa que el render no reviente y que "Pasar el proyecto" salga SOLO para el dueño y
// SOLO si hay a quién pasárselo.
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const KIPO = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const STUB = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '') + '/stub-firebaseConfig.js';
const require = createRequire(`${KIPO}/package.json`);
const { createServer } = await import(pathToFileURL(`${KIPO}/node_modules/vite/dist/node/index.js`).href);
const React = require('react');
const { renderToString } = require('react-dom/server');

const server = await createServer({
  root: KIPO,
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  // Sin el escáner de dependencias: recorre todos los .html del repo, tarda minutos y en
  // el render del servidor no hace falta.
  optimizeDeps: { noDiscovery: true, entries: [] },
  esbuild: { jsx: 'automatic' },
  resolve: { alias: [{ find: /^\.\.\/firebaseConfig$/, replacement: STUB }] },
});

const fallas = [];
const revisar = (nombre, cond) => { if (!cond) fallas.push(nombre); console.log(`${cond ? '✓' : '✗'} ${nombre}`); };
try {
  const { default: EquipoProyecto } = await server.ssrLoadModule('/src/components/EquipoProyecto.jsx');
  const { default: ModalAvisos } = await server.ssrLoadModule('/src/components/ModalAvisos.jsx');
  const theme = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? `t-${k}` : undefined) });

  const proyecto = {
    id: 'P1', nombre: 'Obra Prueba', ownerId: 'A', ownerNombre: 'Ana',
    miembros: { A: { rol: 'dueno' }, B: { rol: 'editor', nombre: 'Beto' }, C: { rol: 'supervisor', nombre: 'Caro' } },
    miembrosUids: ['A', 'B', 'C'],
  };
  const render = (proy, uid) => renderToString(React.createElement(EquipoProyecto, {
    proyecto: proy, user: { uid, email: `${uid}@x.com` }, config: { nombrePersonal: 'X' }, theme,
    amigos: [], setAlertData: () => {}, setConfirmData: () => {}, onClose: () => {},
  }));

  const deA = render(proyecto, 'A');
  revisar('dueño: sale "Pasar el proyecto" con el botón PASAR', deA.includes('Pasar el proyecto') && deA.includes('PASAR'));
  const opciones = [...deA.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(m => `${m[1]}=${m[2]}`);
  revisar('dueño: se le puede pasar a Beto y a Caro, no a sí mismo', ['B=Beto', 'C=Caro'].every(o => opciones.includes(o)) && !opciones.some(o => o.startsWith('A=')));
  revisar('dueño: PASAR empieza apagado (nadie elegido)', /<button[^>]*disabled=""[^>]*>PASAR<\/button>/.test(deA));

  const deB = render(proyecto, 'B');
  revisar('editor: no ve "Pasar el proyecto"', !deB.includes('Pasar el proyecto'));
  revisar('editor: igual ve los miembros', deB.includes('Miembros') && deB.includes('Ana'));

  const solo = { ...proyecto, miembros: { A: { rol: 'dueno' } }, miembrosUids: ['A'] };
  // Paso 6: supervisoresInfo ya no da nombres, y compartidoCon ya no suma miembros
  const conViejo = { ...proyecto, miembros: { A: { rol: 'dueno' }, B: { rol: 'editor' } }, miembrosUids: ['A', 'B'],
    supervisoresInfo: { B: { nombre: 'Beto viejo' } }, compartidoCon: ['Z'], permisos: { Z: 'edicion' } };
  const htmlViejo = render(conViejo, 'A');
  revisar('el nombre ya no sale de supervisoresInfo', !htmlViejo.includes('Beto viejo') && htmlViejo.includes('Miembro'));
  const opcionesViejo = [...htmlViejo.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]);
  revisar('compartidoCon ya no suma a nadie (Z no aparece para pasarle el proyecto)', !opcionesViejo.includes('Z') && opcionesViejo.includes('B'));
  revisar('dueño sin otros miembros: no sale la sección', !render(solo, 'A').includes('Pasar el proyecto'));

  const avisos = renderToString(React.createElement(ModalAvisos, {
    theme, onEntendido: () => {},
    avisos: [
      { id: '1', tipo: 'traspaso', deNombre: 'Ana', proyectoNombre: 'Obra Prueba', rol: 'dueno' },
      { id: '2', tipo: 'agregado', deNombre: 'Ana', proyectoNombre: 'Otra', rol: 'editor' },
      { id: '3', tipo: 'materiales', deNombre: 'Eva', proyectoNombre: 'Obra P', materiales: ['CINTA EVA', 'GRAPA EVA'] },
      { id: '4', tipo: 'materiales', deNombre: 'Eva', proyectoNombre: 'Obra Q', materiales: ['HEBILLA'] },
    ],
  })).replace(/<!-- -->/g, '');
  revisar('aviso de materiales: quién, dónde y cuáles', /Eva<\/span> llevó armados a <span[^>]*>Obra P<\/span> y se agregaron estos 2 materiales a tu catálogo de ferretería: <span[^>]*>CINTA EVA, GRAPA EVA<\/span>/.test(avisos));
  revisar('aviso de materiales: uno solo, en singular', /y se agregó este material a tu catálogo de ferretería: <span[^>]*>HEBILLA<\/span>/.test(avisos));
  revisar('aviso de traspaso: "te pasó el proyecto … ahora eres el dueño"', /Ana<\/span> te pasó el proyecto <span[^>]*>Obra Prueba<\/span>: ahora eres el dueño/.test(avisos));
  revisar('aviso de agregado: sigue igual', /te agregó como <span[^>]*>EDITOR<\/span> del proyecto <span[^>]*>Otra<\/span>/.test(avisos));
  revisar('el de traspaso no dice "te agregó"', (avisos.match(/te agregó/g) || []).length === 1);
} catch (e) {
  fallas.push(`se cayó: ${e.stack || e}`);
  console.log('✗ se cayó:', e);
} finally {
  await server.close();
}
console.log(fallas.length ? `RESULTADO: MAL (${fallas.length})` : 'RESULTADO: OK');
process.exit(fallas.length ? 1 : 0);
